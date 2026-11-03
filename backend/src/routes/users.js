const express = require('express');
const { User } = require('../../models');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/technicians (admin or dispatcher): who can a job be assigned to?
// Only the id, name and availability are sent, never emails or other account details.
router.get('/technicians', requireAuth, requireRole('admin', 'dispatcher'), async (req, res) => {
  const technicians = await User.find({ role: 'technician', isAvailable: true })
    .select('firstName lastName isAvailable')
    .sort({ lastName: 1, firstName: 1 });
  res.json({ technicians });
});

module.exports = router;
