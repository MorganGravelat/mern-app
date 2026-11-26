const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { WorkOrder } = require('../models');
const testDb = require('./db');
const { api, createUser, loginAs, bearer, makeOrder } = require('./helpers');

// GITHUB_WEBHOOK_SECRET is set to 'test-secret' in tests/env.js.
before(testDb.start);
afterEach(testDb.clear);
after(testDb.stop);

function sign(body, secret = 'test-secret') {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Sends a correctly signed webhook request, the way GitHub would.
function sendWebhook(event, payload) {
  const body = JSON.stringify(payload);
  return api
    .post('/api/github/webhook')
    .set('X-GitHub-Event', event)
    .set('X-Hub-Signature-256', sign(body))
    .set('Content-Type', 'application/json')
    .send(body);
}

function push(message, { repo = 'owner/repo', id = 'abc123', author = { username: 'dev' } } = {}) {
  return sendWebhook('push', { repository: { full_name: repo }, commits: [{ id, message, author }] });
}

async function linkedOrder({ repo = 'owner/repo', checklist, status = 'in_progress' } = {}) {
  const staff = await createUser('dispatcher');
  const tech = await createUser('technician');
  return makeOrder(staff, { status, assignedTo: tech._id, githubRepo: repo, checklist });
}

describe('POST /api/github/webhook', () => {
  it('rejects a missing signature', async () => {
    const res = await api.post('/api/github/webhook').set('X-GitHub-Event', 'push').send({ foo: 'bar' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'BAD_SIGNATURE');
  });

  it('rejects a bad signature and one made with the wrong secret', async () => {
    const body = JSON.stringify({ foo: 'bar' });
    for (const signature of ['sha256=deadbeef', sign(body, 'wrong-secret')]) {
      const res = await api
        .post('/api/github/webhook')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);
      assert.equal(res.status, 401);
    }
  });

  it('answers a ping and ignores other events', async () => {
    const ping = await sendWebhook('ping', { zen: 'hi' });
    assert.equal(ping.status, 200);
    assert.equal(ping.body.pong, true);

    const other = await sendWebhook('issues', { action: 'opened' });
    assert.equal(other.status, 200);
    assert.equal(other.body.ignored, 'issues');
  });

  it('answers 400 for a push without a repository', async () => {
    const res = await sendWebhook('push', { commits: [] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'NO_REPO');
  });

  it('marks the matching task done', async () => {
    const order = await linkedOrder({
      checklist: [
        { task: 'a', done: false, taskId: 'OF-101' },
        { task: 'b', done: false, taskId: 'OF-102' }
      ]
    });

    const res = await push('Fix the thing\n\nComplete OF-101');

    assert.equal(res.status, 200);
    assert.equal(res.body.tasksMarked, 1);
    const updated = await WorkOrder.findById(order._id);
    assert.equal(updated.checklist[0].done, true);
    assert.equal(updated.checklist[1].done, false);
    assert.equal(updated.status, 'in_progress');
    assert.equal(updated.autoCompletedBy, null);
  });

  it('reads several markers in any case, but only "Complete OF-XXX" ones', async () => {
    const order = await linkedOrder({
      checklist: [
        { task: 'a', done: false, taskId: 'OF-101' },
        { task: 'b', done: false, taskId: 'OF-102' },
        { task: 'c', done: false, taskId: 'OF-103' }
      ]
    });

    const res = await push('COMPLETE of-101, complete OF-102 (see also OF-103, incomplete OF-103)');

    assert.equal(res.body.tasksMarked, 2);
    const updated = await WorkOrder.findById(order._id);
    assert.deepEqual(updated.checklist.map((item) => item.done), [true, true, false]);
  });

  it('auto-completes the work order when the last task is marked', async () => {
    const order = await linkedOrder({
      checklist: [
        { task: 'a', done: true, taskId: 'OF-200' },
        { task: 'b', done: false, taskId: 'OF-201' }
      ]
    });

    await push('Complete OF-201', { id: 'sha2', author: { name: 'Dev' } });

    const updated = await WorkOrder.findById(order._id);
    assert.equal(updated.status, 'completed');
    assert.ok(updated.completedAt instanceof Date);
    assert.equal(updated.autoCompletedBy.source, 'github-webhook');
    assert.equal(updated.autoCompletedBy.commitSha, 'sha2');
    assert.equal(updated.autoCompletedBy.commitAuthor, 'Dev');
    assert.equal(updated.autoCompletedBy.repoFullName, 'owner/repo');
  });

  it('ignores commits for unlinked repos and unknown task ids', async () => {
    const order = await linkedOrder({
      repo: 'owner/other',
      checklist: [{ task: 'a', done: false, taskId: 'OF-300' }]
    });

    const wrongRepo = await push('Complete OF-300');
    assert.equal(wrongRepo.status, 200);
    assert.equal(wrongRepo.body.tasksMarked, 0);

    const unknownId = await push('Complete OF-999', { repo: 'owner/other' });
    assert.equal(unknownId.body.tasksMarked, 0);

    const updated = await WorkOrder.findById(order._id);
    assert.equal(updated.checklist[0].done, false);
  });
});

describe('task ids on work order edits', () => {
  it('keeps ids when a technician ticks items', async () => {
    const dispatcher = await loginAs('dispatcher');
    const tech = await loginAs('technician');
    const order = await makeOrder(dispatcher.user, {
      status: 'in_progress',
      assignedTo: tech.user._id,
      checklist: [{ task: 'a', done: false, taskId: 'OF-101' }, { task: 'b', done: false, taskId: 'OF-102' }]
    });

    // The technician's client may leave the ids out; they are kept anyway.
    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(tech.token))
      .send({ checklist: [{ task: 'a', done: true }, { task: 'b', done: false }] });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.workOrder.checklist, [
      { task: 'a', done: true, taskId: 'OF-101' },
      { task: 'b', done: false, taskId: 'OF-102' }
    ]);
  });

  it('gives only new items an id when staff edit the checklist, and links a repo', async () => {
    const dispatcher = await loginAs('dispatcher');
    // An old work order from before task ids: its items have none.
    const order = await makeOrder(dispatcher.user, {
      checklist: [{ task: 'old one', done: true }, { task: 'old two', done: false }]
    });

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({
      githubRepo: 'owner/repo',
      checklist: [
        { task: 'old one', done: true, taskId: null },
        { task: 'old two', done: false, taskId: null },
        { task: 'brand new', done: false }
      ]
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.workOrder.githubRepo, 'owner/repo');
    assert.deepEqual(res.body.workOrder.checklist.map((item) => item.taskId), [null, null, 'OF-101']);
  });

  it('does not let staff copy or invent task ids', async () => {
    const dispatcher = await loginAs('dispatcher');
    const order = await makeOrder(dispatcher.user, {
      checklist: [{ task: 'a', done: false, taskId: 'OF-150' }]
    });

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({
      checklist: [
        { task: 'a', done: false, taskId: 'OF-150' },
        { task: 'b', done: false, taskId: 'OF-150' }, // duplicate of an id on this order
        { task: 'c', done: false, taskId: 'OF-777' } // made up
      ]
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.workOrder.checklist.map((item) => item.taskId), ['OF-150', 'OF-101', 'OF-102']);
  });

  it('rejects a githubRepo that is not owner/repo and unlinks with null', async () => {
    const dispatcher = await loginAs('dispatcher');
    const order = await makeOrder(dispatcher.user, { githubRepo: 'owner/repo' });
    const url = `/api/workorders/${order.id}`;

    const bad = await api.patch(url).set(bearer(dispatcher.token)).send({ githubRepo: 'https://github.com/owner/repo' });
    assert.equal(bad.status, 400);

    const unlinked = await api.patch(url).set(bearer(dispatcher.token)).send({ githubRepo: null });
    assert.equal(unlinked.status, 200);
    assert.equal(unlinked.body.workOrder.githubRepo, null);
  });
});
