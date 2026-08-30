// Pure sign-in decisions, deliberately import-free so `node --test` can load this
// module without pulling in Firebase or browser globals.

// Which Google sign-in path a platform should take.
// - 'native'   → Capacitor plugin returns a Google ID token, JS SDK signs in with it
// - 'redirect' → Chrome on iOS opens popups as a new tab and loses the opener
//                reference, so postMessage never arrives; go through the server
// - 'popup'    → every normal browser
export function chooseSignInMethod({ isNative, isChromeIOS }) {
  if (isNative) return 'native';
  if (isChromeIOS) return 'redirect';
  return 'popup';
}

// True when an error just means "the user backed out" — dismissing the popup on
// web, or swiping away the native Google sheet on iOS. These are shown no error.
export function isCancelledSignIn(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return true;
  // The iOS Google SDK words this several ways ("canceled", "cancelled") and the
  // plugin passes it through, so match the stem in the code (which is namespaced).
  if (/cancel/i.test(code)) return true;
  // Message-based detection: check only for user-attributed cancellations. A bare
  // "cancel" substring can appear in real errors ("Upload cancelled: connection reset",
  // "operation was cancelled by the server"), so we must attribute it to the user.
  return /user\s+cancell?ed/i.test(message) || /cancell?ed\s+by\s+(the\s+)?user/i.test(message);
}
