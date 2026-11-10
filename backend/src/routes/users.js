const express = require('express');
const { User, WorkOrder } = require('../../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
