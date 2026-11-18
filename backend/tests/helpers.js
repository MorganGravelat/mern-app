// Small helpers shared by the work order tests.
const request = require('supertest');
const app = require('../src/app');
const { User, WorkOrder } = require('../models');

const api = request(app);
const PASSWORD = 'Password123!';

let userCount = 0;
let orderCount = 2000;

// Creates a verified user straight in the database (skips the email steps).
function createUser(role, overrides = {}) {
  userCount += 1;
  return User.create({
    firstName: `First${userCount}`,
    lastName: `Last${userCount}`,
    login: `${role}${userCount}`,
    email: `${role}${userCount}@example.com`,
    password: PASSWORD,
    role,
    emailVerified: true,
    ...overrides
  });
}

// Creates a user and logs in through the real endpoint, so tests use real tokens.
async function loginAs(role, overrides = {}) {
  const user = await createUser(role, overrides);
  const res = await api.post('/api/auth/login').send({ login: user.login, password: PASSWORD });
  return { user, token: res.body.accessToken };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Creates a work order straight in the database so each test controls its starting state.
function makeOrder(createdBy, overrides = {}) {
  orderCount += 1;
  return WorkOrder.create({
    orderNumber: `WO-${orderCount}`,
    title: 'Printer offline',
    description: 'Front desk printer does not respond.',
    customerName: 'Lakeside Dental',
    location: '1200 Lake Ave',
    category: 'hardware',
    priority: 'medium',
    status: 'pending',
    createdBy: createdBy._id,
    dueDate: new Date('2026-12-01T00:00:00Z'),
    ...overrides
  });
}

const validNewOrder = (overrides = {}) => ({
  title: 'Wi-Fi keeps dropping',
  description: 'Every 15 minutes',
  customerName: 'Brightline Accounting',
  location: '55 Orange Ave',
  category: 'network',
  priority: 'high',
  dueDate: '2026-12-15',
  checklist: [{ task: 'Check access point' }, { task: 'Update firmware' }],
  ...overrides
});

module.exports = { api, PASSWORD, createUser, loginAs, bearer, makeOrder, validNewOrder };
