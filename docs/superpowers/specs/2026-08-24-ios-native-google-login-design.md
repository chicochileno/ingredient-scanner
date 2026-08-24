# iOS Native Google Login — Design

**Date:** 2026-08-24
**Status:** Approved (owner, 2026-08-24)
**Depends on:** `docs/superpowers/specs/2026-08-23-capacitor-ios-finish-design.md`

## Problem

The Capacitor iOS build boots to the Login screen but sign-in is impossible, so
nothing behind auth — Home, History, Lists, Profiles, camera scanning — has ever
run natively. `LoginScreen.jsx` special-cases only Chrome-on-iOS (server-side
`/auth/google` redirect); every other user agent, including the native
WKWebView, calls `signInWithPopup`. Google rejects OAuth inside an embedded
WebView with `disallowed_useragent`.

Native Google login is the single blocker on the iOS app. The `$99` Apple
Developer account is **not** part of it: free personal-team provisioning already
signs a build onto a real iPhone, so camera scanning becomes reachable the
moment sign-in works.

## Approach

Use **`@capacitor-firebase/authentication` v8.4.0 as a credential provider**,
not as a replacement auth system. The native Google sheet returns a Google ID
token; the Firebase JS SDK performs the actual sign-in via
`signInWithCredential`. The JS SDK therefore remains the single source of auth
truth and every existing consumer — `onAuthStateChanged`, Firestore rules,
`server/routes/auth.js` — is untouched.

Compatibility verified 2026-08-24: plugin peers are `@capacitor/core >=8.0.0`
(project has 8.5.0) and `firebase ^12.6.0` (project has 12.14.0). Capacitor 8
uses Swift Package Manager, so no CocoaPods work is involved.

### Rejected alternative (recorded so it is not re-litigated)

Server-side OAuth via `SFSafariViewController` / `ASWebAuthenticationSession`
returning to a custom URL scheme was rejected on **security**, not effort. It
would deliver a Firebase custom token — full account access — through a custom
scheme, and iOS custom schemes are hijackable: any other app may register
`app.ingredientscan://` and conflict resolution is undefined. The safe form is
Universal Links, which need the Associated Domains entitlement and therefore the
paid Apple account. It would also require editing live production
`server/routes/auth.js` to add a second redirect target, and redirect-allowlist
logic is a classic account-takeover surface.

## Architecture

### New module: `web/src/auth.js`

Platform branching currently lives inline in `LoginScreen.jsx`, and
`signOut(auth)` is called directly from `AccountMenu.jsx` and `TermsGate.jsx`.
Three files would each need a native branch. Instead one module owns the
decision and exports:

- `chooseSignInMethod({ isNative, isChromeIOS })` → `'native' | 'redirect' | 'popup'`
  — pure, no imports, unit-tested.
- `signInWithGoogle()` → resolves to a Firebase `User`, or performs a redirect
  and never resolves.
- `signOutEverywhere()` → clears Firebase and, on native, the cached Google
  session.

`firebase.js` keeps owning app/auth initialization only.

### Sign-in

| Platform | Path |
|---|---|
| Native (Capacitor) | lazy `import('@capacitor-firebase/authentication')` → `signInWithGoogle({ skipNativeAuth: true })` → `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` |
| Chrome on iOS | unchanged — `window.location = ${VITE_API_URL}/auth/google` |
| All other browsers | unchanged — `signInWithPopup(auth, googleProvider)` |

The `import()` is inside the native branch so the plugin's web implementation
never enters the browser bundle. The plugin returns the Google ID token at
`result.credential.idToken`; if it is absent the function throws so the failure
surfaces as an error message rather than a silent no-op.

`skipNativeAuth: true` is set **both** in `capacitor.config.json` under
`plugins.FirebaseAuthentication` and passed per call, so the behaviour does not
depend on which of the two the installed version honours.

### Sign-out

`signOutEverywhere()` calls `signOut(auth)` and, when
`Capacitor.isNativePlatform()`, also `FirebaseAuthentication.signOut()`. Without
the second call iOS keeps the Google account cached and the next sign-in
silently reuses it, leaving no way to switch accounts from inside the app. Both
existing call sites (`AccountMenu.jsx`, `TermsGate.jsx`) switch to this helper.

### Native project configuration

- `capacitor.config.json` gains
  `"plugins": { "FirebaseAuthentication": { "skipNativeAuth": true, "providers": ["google.com"] } }`.
- `GoogleService-Info.plist` is placed in `web/ios/App/App/` and added to the App
  target in the Xcode project. The file is **not a secret** — it ships inside
  every iOS binary and contains only public identifiers — so it is committed.
- `Info.plist` gains a `CFBundleURLTypes` entry whose `CFBundleURLSchemes`
  contains the `REVERSED_CLIENT_ID` value from that plist.
- **No Swift changes.** `SceneDelegate.swift` already forwards
  `scene(_:openURLContexts:)` to Capacitor's `SceneDelegateProxy`, which routes
  the OAuth callback to the plugin.
- Install uses `--legacy-peer-deps` (pre-existing `@zxing/browser` ↔
  `@zxing/library` mismatch, unrelated). Capacitor CLI requires Node 22.

### Error handling

Dismissing the native sheet rejects the promise. That rejection is swallowed
silently — no error banner, loading state cleared — matching how
`auth/popup-closed-by-user` and `auth/cancelled-popup-request` are already
ignored in `LoginScreen.jsx`. The exact cancellation error string the plugin
throws is confirmed by cancelling the sheet once in the simulator during
implementation, rather than guessed from documentation. Every other error sets
the existing `login-error` message.

## Owner setup steps

These require the Firebase Console and cannot be done from the repo.

1. Firebase Console → project **`ingredient-scanner-app-c9206`** → gear icon →
   **Project settings** → **General** → **Your apps** → **Add app** → **iOS+**.
2. Apple bundle ID: **`app.ingredientscan`** (must match `capacitor.config.json`
   exactly). Nickname optional; App Store ID left blank.
3. **Register app**, then **Download GoogleService-Info.plist**.
4. Stop there — the console's remaining steps ("Add Firebase SDK", "Add
   initialization code") are for hand-built Xcode apps and are handled by the
   Capacitor plugin.
5. Hand the downloaded file over; it goes into `web/ios/App/App/`.

Registering the iOS app automatically creates the iOS OAuth client in the
underlying Google Cloud project. The Google provider is already enabled in
Firebase Authentication for the web app; no provider changes are needed.

## Testing

- **Unit:** `web/src/auth.test.js` covers `chooseSignInMethod` for the three
  platform combinations, run by `node --test src/*.test.js` alongside the
  existing web tests. The plugin call itself is not unit-testable.
- **Regression:** existing web tests and the 54 server tests must still pass;
  the web sign-in paths and `server/routes/auth.js` receive zero edits.
- **Manual, in the iPhone simulator** — the definition of done:
  1. `npm run build:ios` under Node 22, `npx cap run ios --target <udid>`.
  2. Tap **Continue with Google**, complete the native sheet with the owner's
     normal Google account.
  3. Land on Home and confirm **existing scan history appears**. This is the
     proof that native sign-in resolves to the **same Firebase UID** as web —
     predicted from `server/routes/auth.js` using
     `getUserByProviderUid('google.com', sub)` but never verified.
  4. Sign out, tap Continue with Google again, and confirm the account picker
     reappears rather than silently re-signing in.

Camera scanning stays unverified — the simulator has no camera. It moves to a
separate real-device pass.

## Scope

**In scope beyond the feature itself:**

- The comment in `firebase.js` claiming native sign-in uses "the server-side
  OAuth flow (custom token)" is now false and is rewritten. The behaviour it
  documents — initializing auth without a `popupRedirectResolver` on native —
  remains correct and unchanged.
- Branch `fix/ios-native-auth-init` merges to `main` first, as a standalone
  verified fix; this work then branches from `main`.

**Out of scope:** Sign in with Apple (App Store Guideline 4.8 makes it mandatory
to ship, but the same plugin provides `signInWithApple()` through this identical
credential-provider pattern later); real-device provisioning and camera
verification; app icon, splash, and status-bar theming.
