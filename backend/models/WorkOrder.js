const mongoose = require('mongoose');

// A job on a work order's checklist. It's stored inside the work order
// (embedded) because it never exists on its own.
const checklistItemSchema = new mongoose.Schema(
  {
    task: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false }
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
    completedAt: { type: Date, default: null }
  },
  {
    collection: 'workorders',
    versionKey: false,
    timestamps: true // adds createdAt and updatedAt automatically
  }
);

workOrderSchema.index({ assignedTo: 1, status: 1 });
workOrderSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
