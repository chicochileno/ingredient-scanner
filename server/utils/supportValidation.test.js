const { test } = require('node:test');
const assert = require('node:assert');
const { validateSupportInput } = require('./supportValidation');

test('rejects a missing or empty message', () => {
  assert.strictEqual(validateSupportInput({ message: '' }).ok, false);
  assert.strictEqual(validateSupportInput({ message: '   ' }).ok, false);
  assert.strictEqual(validateSupportInput({}).ok, false);
  assert.strictEqual(validateSupportInput({ message: 42 }).ok, false);
});

test('rejects an over-long message (>5000)', () => {
  const r = validateSupportInput({ message: 'x'.repeat(5001) });
  assert.strictEqual(r.ok, false);
});

test('accepts a valid message and trims it', () => {
  const r = validateSupportInput({ subject: 'Hi', message: '  hello  ' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.message, 'hello');
  assert.strictEqual(r.value.subject, 'Hi');
});

test('defaults a blank/missing subject to "Support request"', () => {
  assert.strictEqual(validateSupportInput({ message: 'hi' }).value.subject, 'Support request');
  assert.strictEqual(validateSupportInput({ subject: '   ', message: 'hi' }).value.subject, 'Support request');
});

test('truncates an over-long subject to 200 chars', () => {
  const r = validateSupportInput({ subject: 'S'.repeat(250), message: 'hi' });
  assert.strictEqual(r.value.subject.length, 200);
});
