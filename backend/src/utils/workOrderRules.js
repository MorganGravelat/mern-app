// The business rules for work orders in one small file, so they are easy to read and test.

const CATEGORIES = ['network', 'hardware', 'software', 'security', 'account'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

// Which status a work order may move to by asking for a status change.
// "pending" -> "assigned" is not listed: it only happens by assigning a technician.
const STATUS_TRANSITIONS = {
  pending: ['cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

// Technicians can start and finish their own jobs, but not cancel them.
const TECHNICIAN_STATUSES = ['in_progress', 'completed'];

function canChangeStatus(from, to) {
  return STATUS_TRANSITIONS[from].includes(to);
}

// Completed and cancelled work orders are final in the base version.
function isFinal(status) {
  return STATUS_TRANSITIONS[status].length === 0;
}

function allChecklistDone(checklist) {
  return checklist.every((item) => item.done); // an empty checklist counts as done
}

// True if the new checklist has the same tasks in the same order (only "done" may differ).
function sameTasks(oldChecklist, newChecklist) {
  return oldChecklist.length === newChecklist.length
    && oldChecklist.every((item, i) => item.task === newChecklist[i].task);
}

// Makes user text safe to use inside a MongoDB $regex, so "(" or ".*" is searched literally.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  STATUS_TRANSITIONS,
  TECHNICIAN_STATUSES,
  canChangeStatus,
  isFinal,
  allChecklistDone,
  sameTasks,
  escapeRegex
};
