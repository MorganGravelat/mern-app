const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

// Matches the "users" collection created by mongo-init.js.
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    login:     { type: String, required: true, unique: true, trim: true, minlength: 3 },
    email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
    password:  { type: String, required: true, select: false }, // bcrypt hash; never returned by default
    role: {
      type: String,
      enum: ['admin', 'dispatcher', 'technician'],
      default: 'technician'
    },
    skills:        { type: [String], default: [] },   // e.g. ['network', 'hardware']; empty for non-technicians
    phone:         { type: String, default: '', trim: true },
    isAvailable:   { type: Boolean, default: true },  // dispatcher checks this before assigning
    emailVerified: { type: Boolean, default: false }, // set true after the email verification link is clicked
    createdAt:     { type: Date, default: Date.now }
  },
  {
    collection: 'users',
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

// Hash the password whenever it's new or changed.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.checkPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
