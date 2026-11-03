const express = require('express');
const { z } = require('zod');
const { User, WorkOrder } = require('../../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { parse } = require('../middleware/validate');
const { createWorkOrder } = require('../utils/orderNumber');
const rules = require('../utils/workOrderRules');

const router = express.Router();
router.use(requireAuth); // every work order route needs a logged-in user

const LIST_LIMIT = 200;

// Replace createdBy / assignedTo ids with just the person's name, nothing else.
const PEOPLE = [
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'assignedTo', select: 'firstName lastName' }
];

// ---------- input shapes (zod) ----------

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');
const text = (max) => z.string().trim().max(max);
// Accepts 2026-11-05 or 2026-11-05T14:00:00Z and turns it into a Date.
const dateInput = z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform((s) => new Date(s));
const taskText = z.string().trim().min(1, 'Task cannot be empty').max(200);

const idParams = z.object({ id: objectId }).strict();

const listQuery = z.object({
  q: text(100).optional(),
  status: z.enum(rules.STATUSES).optional(),
  priority: z.enum(rules.PRIORITIES).optional()
}).strict();

// strict() rejects fields we don't list, such as status, assignedTo or createdBy on create.
const createBody = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: text(2000).default(''),
  customerName: text(100).default(''),
  location: text(200).default(''),
  category: z.enum(rules.CATEGORIES),
  priority: z.enum(rules.PRIORITIES).default('medium'),
  dueDate: dateInput,
  checklist: z.array(z.object({ task: taskText }).strict()).max(20).default([])
}).strict();

const checklistItems = z.array(z.object({ task: taskText, done: z.boolean() }).strict()).max(20);

const staffPatchBody = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(120),
  description: text(2000),
  customerName: text(100),
  location: text(200),
  category: z.enum(rules.CATEGORIES),
  priority: z.enum(rules.PRIORITIES),
  dueDate: dateInput,
  checklist: checklistItems,
  status: z.enum(rules.STATUSES),
  assignedTo: objectId
}).partial().strict()
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to change')
  .refine((body) => !(body.assignedTo && body.status), 'Assign a technician and change the status in separate requests');

const technicianPatchBody = z.object({
  status: z.enum(rules.STATUSES),
  checklist: checklistItems
}).partial().strict()
  .refine((body) => Object.keys(body).length > 0, 'Send a status or a checklist');

// ---------- helpers ----------

const isStaff = (user) => user.role === 'admin' || user.role === 'dispatcher';

// Technicians only ever match jobs assigned to them. Filtering in the database query
// means other technicians' jobs are never even loaded (they look like "not found").
function visibleTo(user) {
  return isStaff(user) ? {} : { assignedTo: user._id };
}

async function findVisibleOrder(id, user) {
  const order = await WorkOrder.findOne({ _id: id, ...visibleTo(user) });
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Work order not found');
  return order;
}

function searchFilter(q) {
  const pattern = rules.escapeRegex(q);
  return { $or: [{ title: { $regex: pattern, $options: 'i' } }, { orderNumber: { $regex: pattern, $options: 'i' } }] };
}

// Gives the assignee to the work order. Only an available technician can be assigned.
async function assign(order, technicianId) {
  const technician = await User.findOne({ _id: technicianId, role: 'technician', isAvailable: true });
  if (!technician) throw new ApiError(400, 'INVALID_ASSIGNEE', 'Assign the job to an available technician');
  if (order.assignedTo && order.assignedTo.equals(technician._id)) return; // already theirs, nothing to do
  order.assignedTo = technician._id;
  // pending -> assigned. A reassigned in-progress job goes back to assigned for the new
  // technician to start (checklist progress is kept).
  order.status = 'assigned';
}

function changeStatus(order, newStatus) {
  if (!rules.canChangeStatus(order.status, newStatus)) {
    const hint = newStatus === 'assigned' ? ' Assign a technician instead.' : '';
    throw new ApiError(409, 'INVALID_TRANSITION', `A ${order.status} work order cannot change to ${newStatus}.${hint}`);
  }
  if (newStatus === 'completed') {
    if (!rules.allChecklistDone(order.checklist)) {
      throw new ApiError(409, 'CHECKLIST_INCOMPLETE', 'Finish every checklist item before completing the work order');
    }
    order.completedAt = new Date();
  }
  order.status = newStatus;
}

async function applyStaffChanges(order, changes) {
  const { assignedTo, status, checklist, ...fields } = changes;
  Object.assign(order, fields);
  if (checklist) order.checklist = checklist;
  if (assignedTo) await assign(order, assignedTo);
  if (status) changeStatus(order, status);
}

function applyTechnicianChanges(order, changes) {
  const { status, checklist } = changes;
  if (checklist) {
    if (!rules.sameTasks(order.checklist, checklist)) {
      throw new ApiError(403, 'FORBIDDEN', 'Technicians can only check items off, not add, remove or rename them');
    }
    order.checklist = checklist;
  }
  if (status) {
    if (!rules.TECHNICIAN_STATUSES.includes(status)) {
      throw new ApiError(403, 'FORBIDDEN', 'Technicians can only start or complete work orders');
    }
    changeStatus(order, status);
  }
}

// ---------- routes ----------

// GET /api/workorders?q=wifi&status=pending&priority=high
router.get('/', async (req, res) => {
  const { q, status, priority } = parse(listQuery, req.query);
  const filter = { ...visibleTo(req.user) };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (q) Object.assign(filter, searchFilter(q));

  const workOrders = await WorkOrder.find(filter).sort({ createdAt: -1 }).limit(LIST_LIMIT).populate(PEOPLE);
  res.json({ workOrders });
});

// GET /api/workorders/:id
router.get('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const order = await findVisibleOrder(id, req.user);
  res.json({ workOrder: await order.populate(PEOPLE) });
});

// POST /api/workorders (admin or dispatcher). New jobs are always pending and unassigned.
router.post('/', requireRole('admin', 'dispatcher'), async (req, res) => {
  const fields = parse(createBody, req.body);
  const checklist = fields.checklist.map((item) => ({ task: item.task, done: false }));
  const order = await createWorkOrder({ ...fields, checklist, createdBy: req.user._id });
  res.status(201).json({ workOrder: await order.populate(PEOPLE) });
});

// PATCH /api/workorders/:id
// Staff can change any field, assign and change status. A technician can only change status
// and checklist, and only on their own jobs.
router.patch('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const order = await findVisibleOrder(id, req.user);

  let changes;
  if (isStaff(req.user)) {
    changes = parse(staffPatchBody, req.body);
  } else {
    const notAllowed = Object.keys(req.body ?? {}).filter((key) => key !== 'status' && key !== 'checklist');
    if (notAllowed.length) {
      throw new ApiError(403, 'FORBIDDEN', `Technicians cannot change: ${notAllowed.join(', ')}`);
    }
    changes = parse(technicianPatchBody, req.body);
  }

  if (rules.isFinal(order.status)) {
    throw new ApiError(409, 'WORK_ORDER_CLOSED', `A ${order.status} work order can no longer be changed`);
  }

  if (isStaff(req.user)) await applyStaffChanges(order, changes);
  else applyTechnicianChanges(order, changes);

  await order.save();
  res.json({ workOrder: await order.populate(PEOPLE) });
});

// DELETE /api/workorders/:id (admin or dispatcher)
router.delete('/:id', requireRole('admin', 'dispatcher'), async (req, res) => {
  const { id } = parse(idParams, req.params);
  const deleted = await WorkOrder.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Work order not found');
  res.status(204).end();
});

module.exports = router;
