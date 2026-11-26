const mongoose = require('mongoose');

// A job on a work order's checklist. It's stored inside the work order
// (embedded) because it never exists on its own.
// taskId is a stable, human-friendly label like "OF-102" that commit
// messages reference (e.g. "Complete OF-102" marks this item done).
const checklistItemSchema = new mongoose.Schema(
  {
    task:   { type: String, required: true, trim: true },
    done:   { type: Boolean, default: false },
    taskId: { type: String, default: null, match: /^OF-\d+$/ }
  },
  { _id: false }
);

// Records how a work order was auto-completed by the GitHub webhook.
// Null (or missing) when the work order was completed by a human instead.
const autoCompletedBySchema = new mongoose.Schema(
  {
    source:        { type: String, enum: ['github-webhook'], required: true },
    commitSha:     { type: String, required: true },
    commitAuthor:  { type: String, default: '' },
    commitMessage: { type: String, default: '' },
    repoFullName:  { type: String, required: true },
    at:            { type: Date, default: Date.now }
  },
  { _id: false }
);

// Matches the "workorders" collection created by mongo-init.js.
const workOrderSchema = new mongoose.Schema(
  {
    orderNumber:  { type: String, required: true, unique: true, match: /^WO-\d+$/ },
    title:        { type: String, required: true, trim: true },
    description:  { type: String, default: '', trim: true },
    customerName: { type: String, default: '', trim: true },
    location:     { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['network', 'hardware', 'software', 'security', 'account'],
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    checklist: { type: [checklistItemSchema], default: [] },

    // References to the users collection (like foreign keys).
    // .populate('createdBy assignedTo') replaces the ids with the user documents.
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    dueDate:     { type: Date, required: true },
    completedAt: { type: Date, default: null },

    // GitHub integration (Phase 1): link this work order to a GitHub repo
    // in the form "owner/repo". Commits in that repo containing
    // "Complete OF-XXX" can auto-tick the matching checklist item.
    githubRepo: {
      type: String,
      default: null,
      trim: true,
      match: /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
    },

    // Set when the webhook auto-completes this WO. Null if a human completed it.
    autoCompletedBy: { type: autoCompletedBySchema, default: null }
  },
  {
    collection: 'workorders',
    versionKey: false,
    timestamps: true // adds createdAt and updatedAt automatically
  }
);

workOrderSchema.index({ assignedTo: 1, status: 1 });
workOrderSchema.index({ status: 1, priority: 1 });
// Fast lookup when the webhook arrives and we need WOs for this repo.
workOrderSchema.index({ githubRepo: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);