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
    password:  { type: String, required: true, select: false }, // bcrypt hash, not returned by default
    role: {
      type: String,
      enum: ['admin', 'dispatcher', 'technician'],
      default: 'technician'
    },
    skills: { type: [String], default: [] }, // e.g. ['network', 'hardware']
    phone: { type: String, default: '', trim: true },
    isAvailable: { type: Boolean, default: true }, // dispatcher checks this before assigning
    emailVerified: { type: Boolean, default: false }, // true after they click the link in the email

    // Tokens for email verification and password reset. We only save the
    // SHA-256 hash, so a leaked database doesn't leak working links.
    emailVerifyTokenHash:   { type: String, default: null, select: false },
    emailVerifyExpires:     { type: Date,   default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires:   { type: Date,   default: null, select: false },

    // Put inside every JWT. Adding 1 (logout, password reset) makes all
    // of the user's old tokens stop working.
    tokenVersion: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'users',
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.emailVerifyTokenHash;
        delete ret.emailVerifyExpires;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.tokenVersion;
        return ret;
      }
    }
  }
);

// Hash the password when it's new or changed.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.checkPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
