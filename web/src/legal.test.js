import { test } from 'node:test';
import assert from 'node:assert';
import { needsTermsAcceptance, isLegalLoading, CURRENT_TERMS_VERSION } from './legal.js';

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

test('isLegalLoading: signed out → not loading', () => {
  assert.strictEqual(isLegalLoading(null, null), false);
  assert.strictEqual(isLegalLoading(undefined, null), false);
});

test('isLegalLoading: signed in but no record loaded yet → loading', () => {
  // The bug this guards: useLegal's signed-out branch left loading:false, so the
  // moment `user` appeared the terms gate rendered against a stale null record
  // and flashed until the first Firestore snapshot arrived.
  assert.strictEqual(isLegalLoading('uid-1', null), true);
});

test('isLegalLoading: record loaded for this user → not loading', () => {
  assert.strictEqual(isLegalLoading('uid-1', 'uid-1'), false);
});

test('isLegalLoading: record loaded for a different user → loading', () => {
  assert.strictEqual(isLegalLoading('uid-2', 'uid-1'), true);
});
