import { test } from 'node:test';
import assert from 'node:assert';
import { needsTermsAcceptance, CURRENT_TERMS_VERSION } from './legal.js';

test('CURRENT_TERMS_VERSION is a positive integer', () => {
  assert.ok(Number.isInteger(CURRENT_TERMS_VERSION) && CURRENT_TERMS_VERSION >= 1);
});

test('needsTermsAcceptance: null/undefined acceptance → true', () => {
  assert.strictEqual(needsTermsAcceptance(null, 1), true);
  assert.strictEqual(needsTermsAcceptance(undefined, 1), true);
});

test('needsTermsAcceptance: acceptance with no version → true', () => {
  assert.strictEqual(needsTermsAcceptance({}, 1), true);
  assert.strictEqual(needsTermsAcceptance({ acceptedAt: 'x' }, 1), true);
});

test('needsTermsAcceptance: older accepted version → true', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 0 }, 1), true);
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 1 }, 2), true);
});

test('needsTermsAcceptance: current or newer version → false', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 1 }, 1), false);
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 2 }, 1), false);
});

test('needsTermsAcceptance: non-numeric version → true', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: '1' }, 1), true);
});
