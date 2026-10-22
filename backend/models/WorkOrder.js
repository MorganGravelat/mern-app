const mongoose = require('mongoose');

// One item on a work order's checklist. Stored inside the work order
// (embedded), because it never exists on its own.
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

    // References to the users collection (the "foreign keys").
    // .populate('createdBy assignedTo') swaps the ids for the full user documents.
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    dueDate:     { type: Date, required: true },
    completedAt: { type: Date, default: null }
  },
  {
    collection: 'workorders',
    versionKey: false,
    timestamps: true // adds and maintains createdAt / updatedAt
  }
);

workOrderSchema.index({ assignedTo: 1, status: 1 });
workOrderSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
