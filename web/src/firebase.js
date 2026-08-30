import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// On the native (Capacitor/WKWebView) build, getAuth()'s automatic popup/redirect
// resolver tries to load a cross-origin iframe from the Firebase authDomain; under
// capacitor://localhost that init promise never resolves, so onAuthStateChanged never
// fires and the app hangs on its loading spinner. Initialize auth explicitly with a
// persistence chain and NO popupRedirectResolver — native sign-in goes through the
// Capacitor plugin and signInWithCredential (see auth.js), never signInWithPopup, so
// the resolver isn't needed here.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  : getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
