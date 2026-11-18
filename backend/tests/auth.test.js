const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { User } = require('../models');
const { testOutbox } = require('../src/utils/email');
const testDb = require('./db');

const api = request(app);
const PASSWORD = 'Password123!';

const newUser = (overrides = {}) => ({
  firstName: 'Jamie',
  lastName: 'Rivera',
  login: 'jrivera',
  email: 'jamie@example.com',
  password: PASSWORD,
  ...overrides
});

// Pulls the ?token=... value out of the last email sent to this address.
function tokenFromEmail(to) {
  const mail = [...testOutbox].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`No email sent to ${to}`);
  return new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
}

async function createVerifiedUser(overrides = {}) {
  const user = await User.create({ ...newUser(overrides), emailVerified: true });
  const res = await api.post('/api/auth/login').send({ login: user.login, password: PASSWORD });
  return { user, ...res.body };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

before(testDb.start);
afterEach(async () => {
  await testDb.clear();
  testOutbox.length = 0;
});
after(testDb.stop);

describe('GET /api/health', () => {
  it('reports the API and database as up', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', db: 'up' });
  });
});

describe('POST /api/auth/register', () => {
  it('creates an unverified technician and emails a verification link', async () => {
    const res = await api.post('/api/auth/register').send(newUser({ role: 'admin' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.login, 'jrivera');
    assert.equal(res.body.user.role, 'technician'); // can't sign yourself up as admin
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.emailVerifyTokenHash, undefined);

    const saved = await User.findOne({ login: 'jrivera' }).select('+password');
    assert.notEqual(saved.password, PASSWORD); // stored as a bcrypt hash
    assert.equal(testOutbox.length, 1);
    assert.match(testOutbox[0].text, /http:\/\/api\.test\/api\/auth\/verify-email\?token=/);
  });

  it('rejects missing fields and weak passwords', async () => {
    const res = await api.post('/api/auth/register').send({ login: 'jr', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    for (const f of ['firstName', 'lastName', 'login', 'email', 'password']) assert.ok(fields.includes(f), f);
  });

  it('rejects a login or email that is already taken', async () => {
    await api.post('/api/auth/register').send(newUser());
    const res = await api.post('/api/auth/register').send(newUser({ login: 'other' }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE');
  });
});

describe('GET /api/auth/verify-email', () => {
  it('verifies the account from the emailed link', async () => {
    await api.post('/api/auth/register').send(newUser());
    const res = await api.get('/api/auth/verify-email').query({ token: tokenFromEmail('jamie@example.com') });
    assert.equal(res.status, 200);
    assert.equal((await User.findOne({ login: 'jrivera' })).emailVerified, true);
  });

  it('rejects an unknown token', async () => {
    const res = await api.get('/api/auth/verify-email').query({ token: 'nope' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies the account, and the token only works once', async () => {
    await api.post('/api/auth/register').send(newUser());
    const token = tokenFromEmail('jamie@example.com');
    assert.equal((await api.post('/api/auth/verify-email').send({ token })).status, 200);
    assert.equal((await api.post('/api/auth/verify-email').send({ token })).status, 400);
  });

  it('rejects an expired token', async () => {
    await api.post('/api/auth/register').send(newUser());
    await User.updateOne({ login: 'jrivera' }, { emailVerifyExpires: new Date(Date.now() - 1000) });
    const res = await api.post('/api/auth/verify-email').send({ token: tokenFromEmail('jamie@example.com') });
    assert.equal(res.status, 400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('sends a new link that replaces the old one', async () => {
    await api.post('/api/auth/register').send(newUser());
    const oldToken = tokenFromEmail('jamie@example.com');
    const res = await api.post('/api/auth/resend-verification').send({ email: 'JAMIE@example.com' });
    assert.equal(res.status, 200);
    assert.equal(testOutbox.length, 2);
    assert.equal((await api.post('/api/auth/verify-email').send({ token: oldToken })).status, 400);
    const newToken = tokenFromEmail('jamie@example.com');
    assert.equal((await api.post('/api/auth/verify-email').send({ token: newToken })).status, 200);
  });

  it('gives the same answer for unknown emails and sends nothing', async () => {
    const res = await api.post('/api/auth/resend-verification').send({ email: 'nobody@example.com' });
    assert.equal(res.status, 200);
    assert.equal(testOutbox.length, 0);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in a verified user by login or by email', async () => {
    await User.create({ ...newUser(), emailVerified: true });
    for (const login of ['jrivera', 'Jamie@Example.com']) {
      const res = await api.post('/api/auth/login').send({ login, password: PASSWORD });
      assert.equal(res.status, 200, login);
      assert.equal(typeof res.body.accessToken, 'string');
      assert.equal(typeof res.body.refreshToken, 'string');
      assert.equal(res.body.user.login, 'jrivera');
    }
  });

  it('rejects a wrong password and an unknown login the same way', async () => {
    await User.create({ ...newUser(), emailVerified: true });
    const wrong = await api.post('/api/auth/login').send({ login: 'jrivera', password: 'Wrong1234' });
    const unknown = await api.post('/api/auth/login').send({ login: 'ghost', password: PASSWORD });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it('blocks login until the email is verified', async () => {
    await api.post('/api/auth/register').send(newUser());
    const res = await api.post('/api/auth/login').send({ login: 'jrivera', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'EMAIL_NOT_VERIFIED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new token pair', async () => {
    const { refreshToken } = await createVerifiedUser();
    const res = await api.post('/api/auth/refresh').send({ refreshToken });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.accessToken, 'string');
  });

  it('rejects an access token used as a refresh token', async () => {
    const { accessToken } = await createVerifiedUser();
    const res = await api.post('/api/auth/refresh').send({ refreshToken: accessToken });
    assert.equal(res.status, 401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes both the access token and the refresh token', async () => {
    const { accessToken, refreshToken } = await createVerifiedUser();
    const res = await api.post('/api/auth/logout').set(bearer(accessToken));
    assert.equal(res.status, 204);
    assert.equal((await api.get('/api/auth/me').set(bearer(accessToken))).status, 401);
    assert.equal((await api.post('/api/auth/refresh').send({ refreshToken })).status, 401);
  });

  it('requires a token', async () => {
    assert.equal((await api.post('/api/auth/logout')).status, 401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('emails a reset link to an existing user', async () => {
    await User.create({ ...newUser(), emailVerified: true });
    const res = await api.post('/api/auth/forgot-password').send({ email: 'jamie@example.com' });
    assert.equal(res.status, 200);
    assert.match(testOutbox[0].text, /http:\/\/app\.test\/reset-password\?token=/);
  });

  it('gives the same answer for unknown emails and sends nothing', async () => {
    const res = await api.post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    assert.equal(res.status, 200);
    assert.equal(testOutbox.length, 0);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('sets the new password, logs out old sessions, and the token only works once', async () => {
    const { refreshToken } = await createVerifiedUser();
    await api.post('/api/auth/forgot-password').send({ email: 'jamie@example.com' });
    const token = tokenFromEmail('jamie@example.com');

    const res = await api.post('/api/auth/reset-password').send({ token, password: 'NewPassword456' });
    assert.equal(res.status, 200);
    assert.equal((await api.post('/api/auth/login').send({ login: 'jrivera', password: PASSWORD })).status, 401);
    assert.equal((await api.post('/api/auth/login').send({ login: 'jrivera', password: 'NewPassword456' })).status, 200);
    assert.equal((await api.post('/api/auth/refresh').send({ refreshToken })).status, 401);
    assert.equal((await api.post('/api/auth/reset-password').send({ token, password: 'Another789x' })).status, 400);
  });

  it('rejects a weak new password', async () => {
    const res = await api.post('/api/auth/reset-password').send({ token: 'abc', password: 'weak' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const { accessToken } = await createVerifiedUser();
    const res = await api.get('/api/auth/me').set(bearer(accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.login, 'jrivera');
    assert.equal(res.body.user.email, 'jamie@example.com');
  });

  it('rejects missing and forged tokens', async () => {
    assert.equal((await api.get('/api/auth/me')).status, 401);
    assert.equal((await api.get('/api/auth/me').set(bearer('not.a.jwt'))).status, 401);
  });
});
