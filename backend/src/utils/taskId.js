const mongoose = require('mongoose');

// One counter document per name in the "counters" collection (see mongo-init.js).
// seq is how many task ids have been handed out so far.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 }
  },
  { collection: 'counters', versionKey: false }
);

const Counter =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const TASK_ID_COUNTER = 'taskId';
// Task ids start at OF-101, so the first one handed out is FIRST_TASK_NUMBER + 1.
const FIRST_TASK_NUMBER = 100;

// Atomically hands out the next global task id: OF-101, OF-102, ...
// $inc on a missing counter starts from 0, so the offset is applied here rather
// than through a schema default (a default would conflict with $inc on upsert).
async function nextTaskId() {
  const result = await Counter.findOneAndUpdate(
    { _id: TASK_ID_COUNTER },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `OF-${FIRST_TASK_NUMBER + result.seq}`;
}

// Gives every checklist item without a taskId a new one. Changes the items in place.
async function assignMissingTaskIds(checklist) {
  if (!Array.isArray(checklist)) return checklist;
  for (const item of checklist) {
    if (!item.taskId) {
      item.taskId = await nextTaskId();
    }
  }
  return checklist;
}

module.exports = { nextTaskId, assignMissingTaskIds };
