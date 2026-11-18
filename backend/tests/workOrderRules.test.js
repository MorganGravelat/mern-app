const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { WorkOrder } = require('../models');
const rules = require('../src/utils/workOrderRules');

describe('work order rules', () => {
  it('only allows the transitions in the table', () => {
    assert.equal(rules.canChangeStatus('pending', 'cancelled'), true);
    assert.equal(rules.canChangeStatus('assigned', 'in_progress'), true);
    assert.equal(rules.canChangeStatus('in_progress', 'completed'), true);
    assert.equal(rules.canChangeStatus('pending', 'in_progress'), false);
    assert.equal(rules.canChangeStatus('completed', 'in_progress'), false);
    assert.equal(rules.canChangeStatus('cancelled', 'pending'), false);
  });

  it('treats completed and cancelled as final', () => {
    assert.deepEqual(rules.STATUSES.filter(rules.isFinal), ['completed', 'cancelled']);
  });

  it('counts an empty checklist as done and an unchecked item as not done', () => {
    assert.equal(rules.allChecklistDone([]), true);
    assert.equal(rules.allChecklistDone([{ task: 'a', done: true }]), true);
    assert.equal(rules.allChecklistDone([{ task: 'a', done: true }, { task: 'b', done: false }]), false);
  });

  it('escapes characters that mean something in a regular expression', () => {
    assert.equal(rules.escapeRegex('a.b(c)*'), 'a\\.b\\(c\\)\\*');
    assert.equal(new RegExp(rules.escapeRegex('(urgent)')).test('Fix (urgent) printer'), true);
  });

  it('uses the same allowed values as the Mongoose model', () => {
    assert.deepEqual(WorkOrder.schema.path('status').enumValues, rules.STATUSES);
    assert.deepEqual(WorkOrder.schema.path('priority').enumValues, rules.PRIORITIES);
    assert.deepEqual(WorkOrder.schema.path('category').enumValues, rules.CATEGORIES);
  });
});
