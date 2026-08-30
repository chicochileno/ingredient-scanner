import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth, googleProvider } from './firebase';
import { chooseSignInMethod } from './authMethod.js';

// Chrome on iOS opens popups as a new tab and loses the opener reference,
// so postMessage back to the original tab never arrives.
const isChromeIOS = /CriOS/.test(navigator.userAgent);

// Google refuses OAuth inside an embedded WebView (`disallowed_useragent`), so the
// native app can't use signInWithPopup. The Capacitor plugin shows the real native
// Google sheet and — with skipNativeAuth — hands back the Google ID token WITHOUT
// signing in itself. We then feed that token to the Firebase JS SDK, which stays the
// single source of auth truth for onAuthStateChanged, Firestore, and the backend.
const NATIVE_SIGN_IN_TIMEOUT_MS = 60_000;
async function signInNative() {
  // Lazy import so the plugin's web implementation never enters the browser bundle.
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

  // The plugin's iOS handler has code paths that return without ever resolving
  // OR rejecting the saved call, so the JS promise can hang forever with no error
  // and no way to recover short of force-quitting the app. Race it against a timeout
  // so a stuck native sheet still surfaces as a normal, catchable sign-in failure.
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Google sign-in timed out. Please try again.'));
    }, NATIVE_SIGN_IN_TIMEOUT_MS);
  });
  const result = await Promise.race([
    FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true }),
    timeout,
  ]);
  clearTimeout(timeoutId);

  const idToken = result?.credential?.idToken;
  if (!idToken) throw new Error('Google sign-in returned no ID token');
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return user;
}

// Resolves to the signed-in User, or to null when a redirect is in flight and the
// page is already navigating away.
export async function signInWithGoogle() {
  const method = chooseSignInMethod({
    isNative: Capacitor.isNativePlatform(),
    isChromeIOS,
  });

  if (method === 'native') return signInNative();

  if (method === 'redirect') {
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/auth/google`;
    return null;
  }

  const { user } = await signInWithPopup(auth, googleProvider);
  return user;
}

// On native, Firebase's signOut leaves the Google account cached by iOS, so the next
// sign-in silently reuses it and there's no way to switch accounts from inside the
// app. Clear the plugin's session too — best-effort, since failing to clear a cached
// session must never block the real sign-out.
export async function signOutEverywhere() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.error('Native Google sign-out failed:', e);
    }
  }
  try {
    await signOut(auth);
  } catch (e) {
    // Both call sites fire-and-forget this (`onClick={() => signOutEverywhere()}`),
    // so an unhandled rejection here would look like a successful sign-out to the
    // user while Firebase silently kept the session. Log it rather than losing it.
    console.error('Sign-out failed:', e);
  }
}
