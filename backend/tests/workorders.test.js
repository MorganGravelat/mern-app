const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { WorkOrder } = require('../models');
const testDb = require('./db');
const { api, loginAs, bearer, makeOrder, validNewOrder, createUser } = require('./helpers');

before(testDb.start);
afterEach(testDb.clear);
after(testDb.stop);

// Most tests need a dispatcher, a technician and one other technician.
async function people() {
  const dispatcher = await loginAs('dispatcher');
  const tech = await loginAs('technician');
  const otherTech = await loginAs('technician');
  return { dispatcher, tech, otherTech };
}

describe('GET /api/workorders', () => {
  it('shows staff every work order and a technician only their own', async () => {
    const { dispatcher, tech, otherTech } = await people();
    const mine = await makeOrder(dispatcher.user, { title: 'Mine', status: 'assigned', assignedTo: tech.user._id });
    await makeOrder(dispatcher.user, { title: 'Theirs', status: 'assigned', assignedTo: otherTech.user._id });
    await makeOrder(dispatcher.user, { title: 'Unassigned' });

    const staffRes = await api.get('/api/workorders').set(bearer(dispatcher.token));
    assert.equal(staffRes.status, 200);
    assert.equal(staffRes.body.workOrders.length, 3);

    const techRes = await api.get('/api/workorders').set(bearer(tech.token));
    assert.equal(techRes.status, 200);
    assert.deepEqual(techRes.body.workOrders.map((o) => o._id), [mine.id]);
    // Only a name is sent for the people, not their email or login
    assert.deepEqual(Object.keys(techRes.body.workOrders[0].assignedTo).sort(), ['_id', 'firstName', 'lastName']);
  });

  it('filters by status and priority and searches the title and order number', async () => {
    const { dispatcher } = await people();
    await makeOrder(dispatcher.user, { orderNumber: 'WO-3001', title: 'Wi-Fi down', priority: 'high' });
    await makeOrder(dispatcher.user, { orderNumber: 'WO-3002', title: 'Printer jam', priority: 'low', status: 'cancelled' });
    const auth = bearer(dispatcher.token);

    const byStatus = await api.get('/api/workorders?status=cancelled').set(auth);
    assert.deepEqual(byStatus.body.workOrders.map((o) => o.orderNumber), ['WO-3002']);

    const byPriority = await api.get('/api/workorders?priority=high').set(auth);
    assert.deepEqual(byPriority.body.workOrders.map((o) => o.orderNumber), ['WO-3001']);

    const byTitle = await api.get('/api/workorders?q=wi-fi').set(auth);
    assert.deepEqual(byTitle.body.workOrders.map((o) => o.orderNumber), ['WO-3001']);

    const byNumber = await api.get('/api/workorders?q=wo-3002').set(auth);
    assert.deepEqual(byNumber.body.workOrders.map((o) => o.title), ['Printer jam']);
  });

  it('searches for the text literally instead of treating it as a regular expression', async () => {
    const { dispatcher } = await people();
    await makeOrder(dispatcher.user, { title: 'Fix (urgent) printer' });
    await makeOrder(dispatcher.user, { title: 'Replace mouse' });
    const auth = bearer(dispatcher.token);

    const parens = await api.get('/api/workorders').query({ q: '(urgent)' }).set(auth);
    assert.equal(parens.status, 200);
    assert.equal(parens.body.workOrders.length, 1);

    const wildcard = await api.get('/api/workorders').query({ q: '.*' }).set(auth);
    assert.equal(wildcard.status, 200);
    assert.equal(wildcard.body.workOrders.length, 0); // as a regex this would match everything
  });

  it('applies the search inside the technician\'s own jobs only', async () => {
    const { dispatcher, tech, otherTech } = await people();
    await makeOrder(dispatcher.user, { title: 'Printer A', status: 'assigned', assignedTo: tech.user._id });
    await makeOrder(dispatcher.user, { title: 'Printer B', status: 'assigned', assignedTo: otherTech.user._id });

    const res = await api.get('/api/workorders?q=printer').set(bearer(tech.token));
    assert.deepEqual(res.body.workOrders.map((o) => o.title), ['Printer A']);
  });

  it('rejects an unknown filter value or parameter, and requires a login', async () => {
    const { dispatcher } = await people();
    const badStatus = await api.get('/api/workorders?status=done').set(bearer(dispatcher.token));
    assert.equal(badStatus.status, 400);
    assert.equal(badStatus.body.error.code, 'VALIDATION_ERROR');

    const unknown = await api.get('/api/workorders?sort=title').set(bearer(dispatcher.token));
    assert.equal(unknown.status, 400);

    const noToken = await api.get('/api/workorders');
    assert.equal(noToken.status, 401);
  });
});

describe('GET /api/workorders/:id', () => {
  it('returns the work order with the creator and assignee names', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });

    const res = await api.get(`/api/workorders/${order.id}`).set(bearer(dispatcher.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.workOrder.orderNumber, order.orderNumber);
    assert.equal(res.body.workOrder.createdBy.firstName, dispatcher.user.firstName);
    assert.equal(res.body.workOrder.assignedTo._id, tech.user.id);
  });

  it('lets the assigned technician read it but not another technician', async () => {
    const { dispatcher, tech, otherTech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });

    const own = await api.get(`/api/workorders/${order.id}`).set(bearer(tech.token));
    assert.equal(own.status, 200);

    const other = await api.get(`/api/workorders/${order.id}`).set(bearer(otherTech.token));
    assert.equal(other.status, 404); // looks the same as a job that does not exist
    assert.equal(other.body.error.code, 'NOT_FOUND');
  });

  it('answers 400 for a malformed id, 404 for a missing one and 401 without a login', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);
    assert.equal((await api.get('/api/workorders/not-an-id').set(auth)).status, 400);
    assert.equal((await api.get('/api/workorders/65f000000000000000000099').set(auth)).status, 404);
    assert.equal((await api.get('/api/workorders/65f000000000000000000099')).status, 401);
  });
});

describe('POST /api/workorders', () => {
  it('creates a pending, unassigned work order owned by the logged-in staff member', async () => {
    const { dispatcher } = await people();

    const res = await api.post('/api/workorders').set(bearer(dispatcher.token)).send(validNewOrder());

    assert.equal(res.status, 201);
    const created = res.body.workOrder;
    assert.match(created.orderNumber, /^WO-\d+$/);
    assert.equal(created.status, 'pending');
    assert.equal(created.assignedTo, null);
    assert.equal(created.createdBy._id, dispatcher.user.id);
    assert.deepEqual(created.checklist, [{ task: 'Check access point', done: false }, { task: 'Update firmware', done: false }]);

    const saved = await WorkOrder.findById(created._id);
    assert.equal(saved.title, 'Wi-Fi keeps dropping');
    assert.equal(saved.dueDate.toISOString(), '2026-12-15T00:00:00.000Z');
    assert.equal(saved.completedAt, null);
  });

  it('gives each new work order the next order number', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);
    await makeOrder(dispatcher.user, { orderNumber: 'WO-1999' });

    const first = await api.post('/api/workorders').set(auth).send(validNewOrder());
    const second = await api.post('/api/workorders').set(auth).send(validNewOrder());

    assert.equal(first.body.workOrder.orderNumber, 'WO-2000');
    assert.equal(second.body.workOrder.orderNumber, 'WO-2001');
  });

  it('gives different order numbers to requests that arrive at the same moment', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => api.post('/api/workorders').set(auth).send(validNewOrder()))
    );

    assert.ok(results.every((r) => r.status === 201), 'every request should succeed after retrying');
    const numbers = results.map((r) => r.body.workOrder.orderNumber);
    assert.equal(new Set(numbers).size, 6);
  });

  it('refuses technicians', async () => {
    const { tech } = await people();
    const res = await api.post('/api/workorders').set(bearer(tech.token)).send(validNewOrder());
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.equal(await WorkOrder.countDocuments(), 0);
  });

  it('requires a login', async () => {
    const res = await api.post('/api/workorders').send(validNewOrder());
    assert.equal(res.status, 401);
  });

  it('rejects missing, invalid and too long fields', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);
    const bad = [
      validNewOrder({ title: '' }),
      validNewOrder({ title: 'x'.repeat(121) }),
      validNewOrder({ category: 'plumbing' }),
      validNewOrder({ priority: 'urgent' }),
      validNewOrder({ dueDate: 'tomorrow' }),
      validNewOrder({ dueDate: undefined }),
      validNewOrder({ checklist: [{ task: '' }] })
    ];
    for (const body of bad) {
      const res = await api.post('/api/workorders').set(auth).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(await WorkOrder.countDocuments(), 0);
  });

  it('rejects fields the server decides itself', async () => {
    const { dispatcher, tech } = await people();
    const auth = bearer(dispatcher.token);
    const extras = [
      { status: 'completed' },
      { assignedTo: tech.user.id },
      { createdBy: tech.user.id },
      { orderNumber: 'WO-1' },
      { completedAt: '2026-01-01' }
    ];
    for (const extra of extras) {
      const res = await api.post('/api/workorders').set(auth).send(validNewOrder(extra));
      assert.equal(res.status, 400, JSON.stringify(extra));
    }
    assert.equal(await WorkOrder.countDocuments(), 0);
  });
});

describe('PATCH /api/workorders/:id (staff)', () => {
  it('edits the ordinary fields', async () => {
    const { dispatcher } = await people();
    const order = await makeOrder(dispatcher.user);

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({
      title: 'Printer offline (urgent)',
      priority: 'critical',
      category: 'network',
      dueDate: '2026-12-31',
      checklist: [{ task: 'Restart printer', done: false }]
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.workOrder.title, 'Printer offline (urgent)');
    const saved = await WorkOrder.findById(order.id);
    assert.equal(saved.priority, 'critical');
    assert.equal(saved.category, 'network');
    assert.equal(saved.checklist.length, 1);
    assert.equal(saved.status, 'pending'); // editing fields does not change the status
  });

  it('assigns a pending work order to an available technician and makes it assigned', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user);

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({ assignedTo: tech.user.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.workOrder.status, 'assigned');
    assert.equal(res.body.workOrder.assignedTo._id, tech.user.id);
    const saved = await WorkOrder.findById(order.id);
    assert.equal(saved.assignedTo.toString(), tech.user.id);
    assert.equal(saved.status, 'assigned');
  });

  it('only assigns to an available technician that exists', async () => {
    const { dispatcher } = await people();
    const admin = await createUser('admin');
    const away = await createUser('technician', { isAvailable: false });
    const order = await makeOrder(dispatcher.user);
    const auth = bearer(dispatcher.token);

    for (const assignedTo of [admin.id, away.id, '65f000000000000000000099']) {
      const res = await api.patch(`/api/workorders/${order.id}`).set(auth).send({ assignedTo });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_ASSIGNEE');
    }
    const saved = await WorkOrder.findById(order.id);
    assert.equal(saved.assignedTo, null);
    assert.equal(saved.status, 'pending');
  });

  it('reassigning an in-progress job gives it to the new technician as assigned and keeps the checklist', async () => {
    const { dispatcher, tech, otherTech } = await people();
    const order = await makeOrder(dispatcher.user, {
      status: 'in_progress',
      assignedTo: tech.user._id,
      checklist: [{ task: 'Step 1', done: true }, { task: 'Step 2', done: false }]
    });

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({ assignedTo: otherTech.user.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.workOrder.status, 'assigned');
    assert.equal(res.body.workOrder.assignedTo._id, otherTech.user.id);
    assert.equal(res.body.workOrder.checklist[0].done, true);
  });

  it('cancels a pending, assigned or in-progress work order', async () => {
    const { dispatcher, tech } = await people();
    for (const status of ['pending', 'assigned', 'in_progress']) {
      const order = await makeOrder(dispatcher.user, { status, assignedTo: status === 'pending' ? null : tech.user._id });
      const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(dispatcher.token)).send({ status: 'cancelled' });
      assert.equal(res.status, 200, status);
      assert.equal(res.body.workOrder.status, 'cancelled');
    }
  });

  it('rejects status changes the transition table does not allow', async () => {
    const { dispatcher, tech } = await people();
    const auth = bearer(dispatcher.token);
    const cases = [
      ['pending', 'in_progress'],
      ['pending', 'assigned'], // must assign a technician instead
      ['pending', 'completed'],
      ['assigned', 'completed'],
      ['in_progress', 'assigned']
    ];
    for (const [from, to] of cases) {
      const order = await makeOrder(dispatcher.user, { status: from, assignedTo: from === 'pending' ? null : tech.user._id });
      const res = await api.patch(`/api/workorders/${order.id}`).set(auth).send({ status: to });
      assert.equal(res.status, 409, `${from} -> ${to}`);
      assert.equal(res.body.error.code, 'INVALID_TRANSITION');
      assert.equal((await WorkOrder.findById(order.id)).status, from);
    }
  });

  it('treats completed and cancelled work orders as final', async () => {
    const { dispatcher, otherTech } = await people();
    const auth = bearer(dispatcher.token);
    for (const status of ['completed', 'cancelled']) {
      const order = await makeOrder(dispatcher.user, { status, completedAt: status === 'completed' ? new Date() : null });
      const edit = await api.patch(`/api/workorders/${order.id}`).set(auth).send({ title: 'Changed' });
      assert.equal(edit.status, 409);
      assert.equal(edit.body.error.code, 'WORK_ORDER_CLOSED');
      const reassign = await api.patch(`/api/workorders/${order.id}`).set(auth).send({ assignedTo: otherTech.user.id });
      assert.equal(reassign.status, 409);
      assert.equal((await WorkOrder.findById(order.id)).title, 'Printer offline');
    }
  });

  it('rejects an empty body, unknown fields and an assignment mixed with a status change', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user);
    const auth = bearer(dispatcher.token);
    const bad = [
      {},
      { orderNumber: 'WO-1' },
      { createdBy: tech.user.id },
      { completedAt: '2026-01-01' },
      { priority: 'urgent' },
      { assignedTo: null },
      { assignedTo: 'nope' },
      { assignedTo: tech.user.id, status: 'cancelled' }
    ];
    for (const body of bad) {
      const res = await api.patch(`/api/workorders/${order.id}`).set(auth).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('answers 400 for a malformed id, 404 for a missing job and 401 without a login', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);
    assert.equal((await api.patch('/api/workorders/bad-id').set(auth).send({ title: 'x' })).status, 400);
    assert.equal((await api.patch('/api/workorders/65f000000000000000000099').set(auth).send({ title: 'x' })).status, 404);
    assert.equal((await api.patch('/api/workorders/65f000000000000000000099').send({ title: 'x' })).status, 401);
  });
});

describe('PATCH /api/workorders/:id (technician)', () => {
  it('starts an assigned job, checks the tasks off and completes it', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user, {
      status: 'assigned',
      assignedTo: tech.user._id,
      checklist: [{ task: 'Step 1', done: false }, { task: 'Step 2', done: false }]
    });
    const auth = bearer(tech.token);
    const url = `/api/workorders/${order.id}`;

    const started = await api.patch(url).set(auth).send({ status: 'in_progress' });
    assert.equal(started.status, 200);
    assert.equal(started.body.workOrder.status, 'in_progress');

    const early = await api.patch(url).set(auth).send({ status: 'completed' });
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'CHECKLIST_INCOMPLETE');

    const checked = await api.patch(url).set(auth).send({ checklist: [{ task: 'Step 1', done: true }, { task: 'Step 2', done: true }] });
    assert.equal(checked.status, 200);

    const finished = await api.patch(url).set(auth).send({ status: 'completed' });
    assert.equal(finished.status, 200);
    assert.equal(finished.body.workOrder.status, 'completed');
    const saved = await WorkOrder.findById(order.id);
    assert.ok(saved.completedAt instanceof Date);
    assert.ok(saved.checklist.every((item) => item.done));
  });

  it('can complete in one request when the checklist is finished in the same request, and an empty checklist is fine', async () => {
    const { dispatcher, tech } = await people();
    const withTasks = await makeOrder(dispatcher.user, { status: 'in_progress', assignedTo: tech.user._id, checklist: [{ task: 'Only step', done: false }] });
    const empty = await makeOrder(dispatcher.user, { status: 'in_progress', assignedTo: tech.user._id });
    const auth = bearer(tech.token);

    const one = await api.patch(`/api/workorders/${withTasks.id}`).set(auth)
      .send({ status: 'completed', checklist: [{ task: 'Only step', done: true }] });
    assert.equal(one.status, 200);
    assert.equal(one.body.workOrder.status, 'completed');

    const two = await api.patch(`/api/workorders/${empty.id}`).set(auth).send({ status: 'completed' });
    assert.equal(two.status, 200);
  });

  it('cannot change priority, assignee, title or any other staff-only field', async () => {
    const { dispatcher, tech, otherTech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });
    const auth = bearer(tech.token);
    const forbidden = [
      { priority: 'low' },
      { assignedTo: otherTech.user.id },
      { createdBy: tech.user.id },
      { orderNumber: 'WO-1' },
      { title: 'Mine now' },
      { dueDate: '2027-01-01' },
      { status: 'in_progress', priority: 'low' } // one allowed field does not excuse a forbidden one
    ];
    for (const body of forbidden) {
      const res = await api.patch(`/api/workorders/${order.id}`).set(auth).send(body);
      assert.equal(res.status, 403, JSON.stringify(body));
      assert.equal(res.body.error.code, 'FORBIDDEN');
    }
    const saved = await WorkOrder.findById(order.id);
    assert.equal(saved.priority, 'medium');
    assert.equal(saved.assignedTo.toString(), tech.user.id);
    assert.equal(saved.status, 'assigned');
  });

  it('cannot cancel, skip steps or add, remove and rename checklist items', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user, {
      status: 'assigned',
      assignedTo: tech.user._id,
      checklist: [{ task: 'Step 1', done: false }]
    });
    const auth = bearer(tech.token);
    const url = `/api/workorders/${order.id}`;

    assert.equal((await api.patch(url).set(auth).send({ status: 'cancelled' })).status, 403);
    assert.equal((await api.patch(url).set(auth).send({ status: 'completed' })).status, 409); // assigned -> completed skips a step
    assert.equal((await api.patch(url).set(auth).send({ checklist: [{ task: 'Renamed', done: true }] })).status, 403);
    assert.equal((await api.patch(url).set(auth).send({ checklist: [] })).status, 403);
    assert.equal((await api.patch(url).set(auth).send({ checklist: [{ task: 'Step 1', done: true }, { task: 'Extra', done: false }] })).status, 403);

    const saved = await WorkOrder.findById(order.id);
    assert.equal(saved.status, 'assigned');
    assert.deepEqual(saved.checklist.map((i) => [i.task, i.done]), [['Step 1', false]]);
  });

  it('cannot read or change a job assigned to another technician', async () => {
    const { dispatcher, tech, otherTech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: otherTech.user._id });

    const res = await api.patch(`/api/workorders/${order.id}`).set(bearer(tech.token)).send({ status: 'in_progress' });

    assert.equal(res.status, 404);
    assert.equal((await WorkOrder.findById(order.id)).status, 'assigned');
  });

  it('cannot change a completed job and must send something to change', async () => {
    const { dispatcher, tech } = await people();
    const done = await makeOrder(dispatcher.user, { status: 'completed', assignedTo: tech.user._id, completedAt: new Date() });
    const open = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });
    const auth = bearer(tech.token);

    const closed = await api.patch(`/api/workorders/${done.id}`).set(auth).send({ status: 'in_progress' });
    assert.equal(closed.status, 409);
    assert.equal(closed.body.error.code, 'WORK_ORDER_CLOSED');

    const empty = await api.patch(`/api/workorders/${open.id}`).set(auth).send({});
    assert.equal(empty.status, 400);
  });
});

describe('DELETE /api/workorders/:id', () => {
  it('lets an admin delete a work order', async () => {
    const admin = await loginAs('admin');
    const order = await makeOrder(admin.user);

    const res = await api.delete(`/api/workorders/${order.id}`).set(bearer(admin.token));

    assert.equal(res.status, 204);
    assert.equal(await WorkOrder.findById(order.id), null);
  });

  it('lets a dispatcher delete a work order', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });
    const res = await api.delete(`/api/workorders/${order.id}`).set(bearer(dispatcher.token));
    assert.equal(res.status, 204);
    assert.equal(await WorkOrder.countDocuments(), 0);
  });

  it('refuses technicians, even for their own job', async () => {
    const { dispatcher, tech } = await people();
    const order = await makeOrder(dispatcher.user, { status: 'assigned', assignedTo: tech.user._id });

    const res = await api.delete(`/api/workorders/${order.id}`).set(bearer(tech.token));

    assert.equal(res.status, 403);
    assert.ok(await WorkOrder.findById(order.id));
  });

  it('answers 400 for a malformed id, 404 for a missing job and 401 without a login', async () => {
    const { dispatcher } = await people();
    const auth = bearer(dispatcher.token);
    assert.equal((await api.delete('/api/workorders/bad-id').set(auth)).status, 400);
    assert.equal((await api.delete('/api/workorders/65f000000000000000000099').set(auth)).status, 404);
    assert.equal((await api.delete('/api/workorders/65f000000000000000000099')).status, 401);
  });
});

describe('GET /api/users/technicians', () => {
  it('lists available technicians with only their id, name and availability', async () => {
    const { dispatcher, tech } = await people();
    await createUser('technician', { isAvailable: false, firstName: 'Away' });
    await createUser('admin');

    const res = await api.get('/api/users/technicians').set(bearer(dispatcher.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.technicians.length, 2); // tech and otherTech; not the unavailable one or the admin
    const found = res.body.technicians.find((t) => t._id === tech.user.id);
    assert.deepEqual(Object.keys(found).sort(), ['_id', 'firstName', 'isAvailable', 'lastName']);
  });

  it('refuses technicians and requires a login', async () => {
    const { tech } = await people();
    assert.equal((await api.get('/api/users/technicians').set(bearer(tech.token))).status, 403);
    assert.equal((await api.get('/api/users/technicians')).status, 401);
  });
});
