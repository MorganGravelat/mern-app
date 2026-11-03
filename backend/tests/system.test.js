const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const testDb = require('./db');

const api = request(app);

before(testDb.start);
after(testDb.stop);

// GET /api/health is covered in auth.test.js.
describe('GET /api/openapi.json', () => {
  it('serves the API description including the work order endpoints', async () => {
    const res = await api.get('/api/openapi.json');
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.ok(res.body.paths['/workorders']);
    assert.ok(res.body.paths['/workorders/{id}']);
    assert.ok(res.body.paths['/users/technicians']);
  });
});

describe('GET /api/docs', () => {
  it('serves the Swagger UI page', async () => {
    const res = await api.get('/api/docs/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /swagger/i);
  });
});

describe('unknown routes', () => {
  it('answer 404 in the standard error shape', async () => {
    const res = await api.get('/api/nothing-here');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
