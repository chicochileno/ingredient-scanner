import { test } from 'node:test';
import assert from 'node:assert';
import { chooseSignInMethod, isCancelledSignIn } from './authMethod.js';

test('chooseSignInMethod: native platform wins over every browser hint', () => {
  assert.strictEqual(chooseSignInMethod({ isNative: true, isChromeIOS: false }), 'native');
  assert.strictEqual(chooseSignInMethod({ isNative: true, isChromeIOS: true }), 'native');
});

test('chooseSignInMethod: Chrome on iOS uses the server redirect', () => {
  assert.strictEqual(chooseSignInMethod({ isNative: false, isChromeIOS: true }), 'redirect');
});

test('chooseSignInMethod: every other browser uses the popup', () => {
  assert.strictEqual(chooseSignInMethod({ isNative: false, isChromeIOS: false }), 'popup');
});

test('isCancelledSignIn: known Firebase popup cancellations', () => {
  assert.strictEqual(isCancelledSignIn({ code: 'auth/popup-closed-by-user' }), true);
  assert.strictEqual(isCancelledSignIn({ code: 'auth/cancelled-popup-request' }), true);
});

test('isCancelledSignIn: native cancellations by code or message', () => {
  assert.strictEqual(isCancelledSignIn({ code: 'auth/cancelled' }), true);
  assert.strictEqual(isCancelledSignIn({ message: 'The user canceled the sign-in flow.' }), true);
  assert.strictEqual(isCancelledSignIn({ message: 'Sign in cancelled by user' }), true);
});

test('isCancelledSignIn: real failures are not swallowed', () => {
  assert.strictEqual(isCancelledSignIn({ code: 'auth/network-request-failed' }), false);
  assert.strictEqual(isCancelledSignIn({ message: 'Google sign-in returned no ID token' }), false);
  assert.strictEqual(isCancelledSignIn(undefined), false);
  // Boundary: "cancel" substring without user attribution is not a user cancellation
  assert.strictEqual(isCancelledSignIn({ message: 'Upload cancelled: connection reset' }), false);
  assert.strictEqual(isCancelledSignIn({ code: 'auth/internal-error', message: 'operation was cancelled by the server' }), false);
  assert.strictEqual(isCancelledSignIn({ message: 'Request cancelled due to session timeout' }), false);
});
