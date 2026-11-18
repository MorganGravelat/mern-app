const express = require('express');
const { z } = require('zod');
const { User, WorkOrder } = require('../../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { parse } = require('../middleware/validate');

const router = express.Router();

const ROLE_ORDER = { admin: 0, dispatcher: 1, technician: 2 };

const idParams = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id') }).strict();
// Admin accounts are seeded root accounts, not something granted from this page; only
// toggling between dispatcher (staff) and technician is supported.
const roleBody = z.object({ role: z.enum(['dispatcher', 'technician'], { error: 'Role must be dispatcher or technician' }) }).strict();

// A technician is "busy" with a job while it's assigned or in progress;
// completed and cancelled jobs no longer count against them.
const ACTIVE_STATUSES = ['assigned', 'in_progress'];

// GET /api/users/technicians (admin or dispatcher): who can a job be assigned to?
// Only the id, name and availability are sent, never emails or other account details.
// Also returns each technician's current active job count so dispatchers can see
// who has room for the next job, sorted with the lightest workload first.
router.get('/technicians', requireAuth, requireRole('admin', 'dispatcher'), async (req, res) => {
  const technicians = await User.find({ role: 'technician', isAvailable: true })
    .select('firstName lastName isAvailable')
    .lean();

  const counts = await WorkOrder.aggregate([
    { $match: { assignedTo: { $ne: null }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
  ]);
  const countByTechnicianId = new Map(counts.map((c) => [c._id.toString(), c.count]));

  for (const tech of technicians) {
    tech.activeJobCount = countByTechnicianId.get(tech._id.toString()) || 0;
  }

  // Fewest active jobs first (the recommended technician); ties broken alphabetically.
  technicians.sort((a, b) =>
    a.activeJobCount - b.activeJobCount ||
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName)
  );

  res.json({ technicians });
});

// GET /api/users (admin or dispatcher): everyone with an account, for the user management page.
// Only the id, name, login and role are sent. Sorted admins first, then dispatchers, then technicians.
router.get('/', requireAuth, requireRole('admin', 'dispatcher'), async (req, res) => {
  const users = await User.find().select('firstName lastName login role').lean();
  users.sort((a, b) =>
    ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName)
  );
  res.json({ users });
});

// PATCH /api/users/:id/role (admin or dispatcher): promote a technician to dispatcher,
// or demote a dispatcher back to technician. Admin accounts are seeded root accounts and
// can't be changed here, and nobody can change their own role (even an admin or dispatcher).
// requireAuth reloads the user on every request, so the new role applies right away.
router.patch('/:id/role', requireAuth, requireRole('admin', 'dispatcher'), async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { role } = parse(roleBody, req.body);
  if (id === req.user._id.toString()) {
    throw new ApiError(400, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
  }
  const target = await User.findById(id).select('role').lean();
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  if (target.role === 'admin') {
    throw new ApiError(400, 'ADMIN_ROLE_LOCKED', 'Admin accounts are managed outside the app');
  }
  const user = await User.findByIdAndUpdate(id, { role }, { returnDocument: 'after' })
    .select('firstName lastName login role')
    .lean();
  res.json({ user });
});

module.exports = router;
