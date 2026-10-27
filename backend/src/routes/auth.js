const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { User } = require('../../models');
const config = require('../config');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { createEmailToken, hashToken, issueTokens, verifyRefreshToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Limits how many tries one ip gets, so people can't guess passwords or spam emails. Skipped in tests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a few minutes' } }
});

const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt only uses the first 72 bytes
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

const schemas = {
  register: z.object({
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    login: z.string().trim().min(3, 'Login must be at least 3 characters').max(30)
      .regex(/^[A-Za-z0-9._-]+$/, 'Login can only use letters, numbers, dots, dashes and underscores'),
    email,
    password
  }),
  login: z.object({
    login: z.string().trim().min(1, 'Enter your login or email'),
    password: z.string().min(1, 'Enter your password')
  }),
  token: z.object({ token: z.string().trim().min(1, 'Token is required') }),
  email: z.object({ email }),
  refresh: z.object({ refreshToken: z.string().min(1, 'Refresh token is required') }),
  reset: z.object({ token: z.string().trim().min(1, 'Token is required'), password })
};

// Always send this reply, even if the email isn't in the database, so nobody can check which emails have accounts.
const GENERIC_EMAIL_REPLY = { message: 'If that email belongs to an account, we sent it a link.' };

function sessionResponse(user) {
  return { ...issueTokens(user), user };
}

// POST /api/auth/register
router.post('/register', authLimiter, validate(schemas.register), async (req, res) => {
  const { token, hash } = createEmailToken();
  const user = await User.create({
    ...req.body,
    role: 'technician', // new users are always technicians, an admin can change it later
    emailVerifyTokenHash: hash,
    emailVerifyExpires: new Date(Date.now() + VERIFY_TTL_MS)
  });
  await sendVerificationEmail(user, token);
  res.status(201).json({ message: 'Account created. Check your email for a verification link.', user });
});

async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpires: { $gt: new Date() }
  });
  if (!user) throw new ApiError(400, 'INVALID_TOKEN', 'This verification link is invalid or has expired');
  user.emailVerified = true;
  user.emailVerifyTokenHash = null;
  user.emailVerifyExpires = null;
  await user.save();
  return user;
}

// GET /api/auth/verify-email?token=... (this is the link in the email)
router.get('/verify-email', async (req, res) => {
  const result = schemas.token.safeParse({ token: req.query.token });
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Token is required');
  await verifyEmail(result.data.token);
  res.json({ message: 'Email verified. You can now log in.' });
});

// POST /api/auth/verify-email { token } (for the web and mobile apps)
router.post('/verify-email', validate(schemas.token), async (req, res) => {
  await verifyEmail(req.body.token);
  res.json({ message: 'Email verified. You can now log in.' });
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, validate(schemas.email), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.emailVerified) {
    const { token, hash } = createEmailToken();
    user.emailVerifyTokenHash = hash;
    user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
    await user.save();
    await sendVerificationEmail(user, token);
  }
  res.json(GENERIC_EMAIL_REPLY);
});

// POST /api/auth/login  { login, password }  (login can be the username or the email)
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  const { login, password: plain } = req.body;
  const user = await User.findOne(login.includes('@') ? { email: login.toLowerCase() } : { login }).select('+password');
  if (!user || !(await user.checkPassword(plain))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Login or password is incorrect');
  }
  if (!user.emailVerified) {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in');
  }
  res.json(sessionResponse(user));
});

// POST /api/auth/refresh { refreshToken } gives back a new access and refresh token
router.post('/refresh', validate(schemas.refresh), async (req, res) => {
  let payload;
  try {
    payload = verifyRefreshToken(req.body.refreshToken);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Refresh token is invalid or expired');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Refresh token has been revoked');
  }
  res.json(sessionResponse(user));
});

// POST /api/auth/logout logs the user out everywhere (web and mobile)
router.post('/logout', requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.status(204).end();
});

// POST /api/auth/forgot-password { email }
router.post('/forgot-password', authLimiter, validate(schemas.email), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const { token, hash } = createEmailToken();
    user.passwordResetTokenHash = hash;
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();
    await sendPasswordResetEmail(user, token);
  }
  res.json(GENERIC_EMAIL_REPLY);
});

// POST /api/auth/reset-password { token, password }
router.post('/reset-password', authLimiter, validate(schemas.reset), async (req, res) => {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(req.body.token),
    passwordResetExpires: { $gt: new Date() }
  });
  if (!user) throw new ApiError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired');
  user.password = req.body.password; // gets hashed in the pre-save hook
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.emailVerified = true; // they got the reset email, so the email is real
  user.tokenVersion += 1; // logs out all old sessions
  await user.save();
  res.json({ message: 'Password updated. You can now log in.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
