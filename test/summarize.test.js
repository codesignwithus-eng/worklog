const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../api/summarize');

test('categorizes completed, blocked, follow-up, and pending lines', () => {
  const result = summarize([
    '[x] Sent the quotation to Acme',
    '[!] Blocked waiting on pricing from supplier',
    'Email Sara about the delivery date',
    'Prepare next week draft',
  ].join('\n'), ['Send quotation']);
  assert.ok(result.done.some((x) => x.includes('Sent the quotation')));
  assert.ok(result.problems.some((x) => x.includes('Blocked')));
  assert.ok(result.actions.some((x) => x.task.includes('Email Sara')));
  assert.ok(result.pending.some((x) => x.includes('Prepare next week draft')));
  assert.equal(result.plan_check[0].status, 'done');
});

test('returns empty categories for empty notes and omits priority checks without priorities', () => {
  const result = summarize('', []);
  assert.deepEqual(result.done, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.plan_check, []);
});
