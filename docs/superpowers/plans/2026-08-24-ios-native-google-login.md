# iOS Native Google Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Continue with Google" work inside the Capacitor iOS app, so the rest of the app becomes reachable natively for the first time.

**Architecture:** The `@capacitor-firebase/authentication` plugin is used purely as a *credential provider* — the native Google sheet returns a Google ID token and the Firebase JS SDK does the real sign-in via `signInWithCredential`. All platform branching moves out of the components into `web/src/auth.js`, backed by pure, unit-tested helpers in `web/src/authMethod.js`. Web sign-in paths and the backend are untouched.

**Tech Stack:** React 19 + Vite 8, Firebase JS SDK 12.14, Capacitor 8.5 (Swift Package Manager), `@capacitor-firebase/authentication` 8.4.0, `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-24-ios-native-google-login-design.md`

## Global Constraints

- **Node 22 is mandatory for anything Capacitor.** The `node` on `PATH` is v12 and will fail. Prefix every Capacitor/npm command with:
  `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`
- **All npm installs need `--legacy-peer-deps`** — pre-existing `@zxing/browser` ↔ `@zxing/library` peer mismatch, unrelated to this work.
- **Plugin version is pinned: `@capacitor-firebase/authentication@8.4.0`.** Peers verified 2026-08-24: `@capacitor/core >=8.0.0` (have 8.5.0), `firebase ^12.6.0` (have 12.14.0).
- **Bundle ID is `app.ingredientscan`** and must stay identical in `web/capacitor.config.json`, `GoogleService-Info.plist` (`BUNDLE_ID`), and the Xcode target.
- **`REVERSED_CLIENT_ID` is `com.googleusercontent.apps.448790066973-381kri90e7f95ii49hro3fqmlfnu6su0`** — used verbatim as the `Info.plist` URL scheme.
- **Zero edits to `server/`.** The backend and `server/routes/auth.js` are out of bounds; the web Google paths (`signInWithPopup`, Chrome-iOS redirect) must behave exactly as they do today.
- **Web tests are run as `node --test src/*.test.js` from `web/`** — there is no `npm test` script in `web/package.json`. Do not add one.
- **Ruby with the `xcodeproj` gem** (for Xcode project edits) is reached via:
  `GEM_HOME=/usr/local/Cellar/cocoapods/1.16.2_2/libexec /usr/local/opt/ruby/bin/ruby`

---

### Task 0: Merge the auth-init fix and open the feature branch

The branch `fix/ios-native-auth-init` holds commit `0b98d4d`, the verified fix that stops the native app hanging on its loading spinner. It is standalone and belongs on `main` before this work starts.

**Files:**
- Modify: none (git operations only)

**Interfaces:**
- Consumes: nothing
- Produces: branch `feat/ios-native-google-login` cut from an updated `main`

- [ ] **Step 1: Confirm with the owner before pushing**

Pushing `main` auto-deploys **both** the frontend (Firebase Hosting) and the backend (Railway). The change is web-safe — `firebase.js` only alters the native branch of auth init — but the deploy is real. Ask the owner to confirm, and do not push without an explicit yes.

- [ ] **Step 2: Merge the fix into main**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git checkout main
git merge --ff-only fix/ios-native-auth-init
```

Expected: fast-forward to `7beb28a` (the fix plus the design spec).

- [ ] **Step 3: Push and confirm the deploys are green**

```bash
git push origin main
```

Then check that Firebase Hosting and Railway both finished without errors before continuing.

- [ ] **Step 4: Cut the feature branch**

```bash
git checkout -b feat/ios-native-google-login
git branch -d fix/ios-native-auth-init
```

---

### Task 1: Pure sign-in helpers (`authMethod.js`)

Two decisions need to be testable without a browser, a device, or Firebase: *which* sign-in path to take, and *whether* an error is just the user backing out. Both live in an import-free module so `node --test` can load them directly — the same pattern as the existing `historyFlags.js`, `homeModel.js`, and `headerModel.js`.

**Files:**
- Create: `web/src/authMethod.js`
- Test: `web/src/authMethod.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `chooseSignInMethod({ isNative, isChromeIOS })` → `'native' | 'redirect' | 'popup'`
  - `isCancelledSignIn(error)` → `boolean`

- [ ] **Step 1: Write the failing test**

Create `web/src/authMethod.test.js`:

```js
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && node --test src/authMethod.test.js
```

Expected: FAIL — `Cannot find module './authMethod.js'`.

- [ ] **Step 3: Write the implementation**

Create `web/src/authMethod.js`:

```js
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
  // plugin passes it through, so match the stem in both the code and the message.
  return /cancel/i.test(code) || /cancel/i.test(message);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && node --test src/authMethod.test.js
```

Expected: PASS, 6/6.

- [ ] **Step 5: Run the whole web suite for regressions**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && node --test src/*.test.js
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/authMethod.js web/src/authMethod.test.js
git commit -m "feat(auth): pure sign-in method and cancellation helpers"
```

---

### Task 2: `auth.js` — the one module that knows about platforms

Installs the plugin and moves every platform decision behind two functions. After this task the web build is complete and unchanged in behaviour; the native path exists but cannot run until Task 3 wires the iOS project.

**Files:**
- Create: `web/src/auth.js`
- Modify: `web/package.json` (plugin dependency), `web/capacitor.config.json` (plugin config), `web/src/LoginScreen.jsx` (lines 2-3, 7, 29-49), `web/src/AccountMenu.jsx:2,43`, `web/src/TermsGate.jsx:3,75`, `web/src/firebase.js:28-33` (stale comment)
- Test: `web/src/authMethod.test.js` (already covers the logic; no new unit tests — the rest is I/O glue)

**Interfaces:**
- Consumes: `chooseSignInMethod`, `isCancelledSignIn` from `./authMethod.js`; `auth`, `googleProvider` from `./firebase.js`
- Produces:
  - `signInWithGoogle()` → `Promise<User | null>` (`null` when a redirect is in flight and the page is navigating away)
  - `signOutEverywhere()` → `Promise<void>`

- [ ] **Step 1: Install the plugin**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm install @capacitor-firebase/authentication@8.4.0 --legacy-peer-deps
```

Expected: `package.json` gains the dependency; no peer-dependency errors beyond the known `@zxing` warning.

- [ ] **Step 2: Configure the plugin**

Replace the contents of `web/capacitor.config.json` with:

```json
{
  "appId": "app.ingredientscan",
  "appName": "IngredientScan",
  "webDir": "dist",
  "plugins": {
    "FirebaseAuthentication": {
      "skipNativeAuth": true,
      "providers": ["google.com"]
    }
  }
}
```

`skipNativeAuth` is set here *and* passed per call in Step 3, so behaviour does not depend on which of the two the installed version honours.

- [ ] **Step 3: Create `web/src/auth.js`**

```js
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
async function signInNative() {
  // Lazy import so the plugin's web implementation never enters the browser bundle.
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
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
  await signOut(auth);
}
```

- [ ] **Step 4: Rewire `LoginScreen.jsx`**

Replace the imports at the top (current lines 2-3 and the `isChromeIOS` const on line 7, which now lives in `auth.js`):

```js
import { signInWithGoogle } from './auth';
import { isCancelledSignIn } from './authMethod.js';
```

Delete the `import { signInWithPopup } from 'firebase/auth';` line, the `import { auth, googleProvider } from './firebase';` line, the `isChromeIOS` const, and its two-line comment. Then replace `handleGoogle` with:

```js
  async function handleGoogle() {
    setLoading('google');
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) onSignedIn(user);
      // A null user means a redirect is in flight — leave the spinner up.
    } catch (e) {
      if (!isCancelledSignIn(e)) setError(`Sign in failed: ${e.message}`);
      setLoading(null);
    }
  }
```

- [ ] **Step 5: Rewire both sign-out call sites**

In `web/src/AccountMenu.jsx`: delete `import { signOut } from 'firebase/auth';` (line 2), add `import { signOutEverywhere } from './auth';`, and change line 43's handler from `onClick={() => signOut(auth)}` to `onClick={() => signOutEverywhere()}`.

In `web/src/TermsGate.jsx`: delete `import { signOut } from 'firebase/auth';` (line 3), add `import { signOutEverywhere } from './auth';`, and change line 75's handler from `onClick={() => signOut(auth)}` to `onClick={() => signOutEverywhere()}`.

In both files check whether `auth` from `./firebase` is still used elsewhere in the file; if it is not, drop it from that import too. Leave every other import alone.

- [ ] **Step 6: Fix the stale comment in `firebase.js`**

The comment at `web/src/firebase.js:28-33` ends by claiming native sign-in uses "the server-side OAuth flow (custom token)". That approach was rejected. Replace that final sentence with:

```js
// fires and the app hangs on its loading spinner. Initialize auth explicitly with a
// persistence chain and NO popupRedirectResolver — native sign-in goes through the
// Capacitor plugin and signInWithCredential (see auth.js), never signInWithPopup, so
// the resolver isn't needed here.
```

Keep the rest of the comment and all the code unchanged — the behaviour it documents is still correct.

- [ ] **Step 7: Verify the web build and tests**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && node --test src/*.test.js && npm run lint && npm run build
```

Expected: tests pass, lint clean, build succeeds. Then confirm the plugin did **not** leak into the main browser bundle:

```bash
grep -rl "capacitor-firebase" web/dist/assets/ || echo "not in main bundle (expected)"
```

Expected: either no match, or matches only in a separate lazily-loaded chunk — never in the entry bundle.

- [ ] **Step 8: Confirm the backend is untouched**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd server && npm test
```

Expected: 54/54 pass. Nothing in this task edits `server/`, so a failure here means something went wrong outside the plan.

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/capacitor.config.json \
        web/src/auth.js web/src/LoginScreen.jsx web/src/AccountMenu.jsx \
        web/src/TermsGate.jsx web/src/firebase.js
git commit -m "feat(auth): route Google sign-in and sign-out through auth.js"
```

---

### Task 3: Wire the iOS project

Puts the owner-supplied `GoogleService-Info.plist` into the App target and registers the OAuth callback URL scheme. `SceneDelegate.swift:19` already forwards `scene(_:openURLContexts:)` to Capacitor's `SceneDelegateProxy`, so **no Swift changes are needed** — the callback routing exists.

**Files:**
- Create: `web/ios/App/App/GoogleService-Info.plist` (copied from `~/Downloads`)
- Modify: `web/ios/App/App/Info.plist` (add `CFBundleURLTypes`), `web/ios/App/App.xcodeproj/project.pbxproj` (add the plist to the App target), `web/ios/App/CapApp-SPM/Package.swift` (regenerated by `cap sync`)

**Interfaces:**
- Consumes: the plugin dependency installed in Task 2
- Produces: an iOS build that contains `GoogleService-Info.plist` and handles the `com.googleusercontent.apps.*` URL scheme

- [ ] **Step 1: Copy the plist in and verify its contents**

```bash
cp ~/Downloads/GoogleService-Info.plist web/ios/App/App/GoogleService-Info.plist
plutil -p web/ios/App/App/GoogleService-Info.plist | grep -E "BUNDLE_ID|PROJECT_ID|REVERSED_CLIENT_ID"
```

Expected exactly:
- `BUNDLE_ID => app.ingredientscan`
- `PROJECT_ID => ingredient-scanner-app-c9206`
- `REVERSED_CLIENT_ID => com.googleusercontent.apps.448790066973-381kri90e7f95ii49hro3fqmlfnu6su0`

If `BUNDLE_ID` differs, stop — the app was registered in Firebase under the wrong bundle ID and must be re-registered.

- [ ] **Step 2: Confirm the plist will actually be committed**

```bash
git check-ignore -v web/ios/App/App/GoogleService-Info.plist || echo "not ignored (expected)"
```

Expected: "not ignored". `web/ios/.gitignore` excludes `App/App/public`, `App/App/capacitor.config.json`, and `App/App/config.xml`, but not this file. It is safe to commit — it holds only public identifiers and ships inside every iOS binary.

- [ ] **Step 3: Add the plist to the Xcode App target**

```bash
GEM_HOME=/usr/local/Cellar/cocoapods/1.16.2_2/libexec \
/usr/local/opt/ruby/bin/ruby -e '
require "xcodeproj"
project = Xcodeproj::Project.open("web/ios/App/App.xcodeproj")
target = project.targets.find { |t| t.name == "App" }
group = project.main_group["App"]
unless group.files.any? { |f| f.path == "GoogleService-Info.plist" }
  ref = group.new_reference("GoogleService-Info.plist")
  target.add_resources([ref])
  project.save
  puts "added"
end
puts "done"
'
```

Expected: prints `added` then `done`. Confirm the project file now references it:

```bash
grep -c "GoogleService-Info.plist" web/ios/App/App.xcodeproj/project.pbxproj
```

Expected: `3` or more (file reference, build file, and resources-phase entry).

- [ ] **Step 4: Add the URL scheme to `Info.plist`**

```bash
plutil -insert CFBundleURLTypes -json \
  '[{"CFBundleURLSchemes":["com.googleusercontent.apps.448790066973-381kri90e7f95ii49hro3fqmlfnu6su0"]}]' \
  web/ios/App/App/Info.plist
plutil -p web/ios/App/App/Info.plist | grep -A4 CFBundleURLTypes
```

Expected: the scheme is listed. (`CFBundleURLTypes` did not exist in this file before, so `-insert` is correct — do not use `-replace`.)

- [ ] **Step 5: Sync and build**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm run build:ios
```

Expected: Vite build succeeds and `cap sync ios` reports `@capacitor-firebase/authentication` among the found plugins. This regenerates `web/ios/App/CapApp-SPM/Package.swift` to include the plugin's Swift package.

- [ ] **Step 6: Commit**

```bash
git add web/ios/App/App/GoogleService-Info.plist web/ios/App/App/Info.plist \
        web/ios/App/App.xcodeproj/project.pbxproj web/ios/App/CapApp-SPM/Package.swift
git commit -m "feat(ios): add Firebase iOS config and Google OAuth URL scheme"
```

---

### Task 4: Verify in the simulator

The real test. Nothing before this proves native sign-in works, and one specific claim has never been verified: that native sign-in resolves to the **same Firebase UID** as web.

**Files:**
- Modify: `web/src/authMethod.js` (only if Step 4 reveals a cancellation string the helper misses)

**Interfaces:**
- Consumes: everything from Tasks 1-3
- Produces: a verified native sign-in, and the evidence for it

- [ ] **Step 1: Boot the app**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
xcrun simctl list devices available | grep -i iphone
cd web && npx cap run ios --target <udid-from-above>
```

Expected: the app launches to the Login screen (not a stuck spinner).

- [ ] **Step 2: Confirm the config file actually shipped inside the app**

```bash
ls "$(xcrun simctl get_app_container booted app.ingredientscan)/GoogleService-Info.plist"
```

Expected: the path prints. If "No such file", Task 3 Step 3 did not take effect and the target membership must be fixed before sign-in can work.

- [ ] **Step 3: Sign in with the owner's real Google account**

Tap **Continue with Google**. Expected: the native Google sheet appears — not an in-page web view, and no `disallowed_useragent` error.

Complete the sign-in. Expected: the app lands on Home.

- [ ] **Step 4: THE critical check — same Firebase UID as web**

On Home, look at the scan history.

Expected: **the owner's existing scans from the web app are listed.** This is the whole point of the credential-provider approach and was predicted but never proven — `server/routes/auth.js` matches accounts via `getUserByProviderUid('google.com', sub)`.

If the history is empty, **stop and report it**. That means native sign-in created a *new* Firebase user, and the design's core assumption is wrong — do not paper over it by continuing to Step 5.

- [ ] **Step 5: Verify cancellation is silent**

Sign out, tap **Continue with Google**, then dismiss the Google sheet without choosing an account.

Expected: no red error message, and the button returns to its idle state. If an error banner appears, read the actual error in Safari's Web Inspector (Develop → Simulator → the app's web view), then add the missing string to `isCancelledSignIn` in `web/src/authMethod.js` plus a case in `authMethod.test.js`, rerun `node --test src/*.test.js`, and commit.

- [ ] **Step 6: Verify sign-out clears the Google session**

After signing out, tap **Continue with Google** again.

Expected: the **account picker appears** rather than instantly signing back in. That is `signOutEverywhere` clearing the plugin's cached session, and it is what makes switching accounts possible.

- [ ] **Step 7: Confirm the web app still works**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm run dev
```

Sign out and back in in a desktop browser. Expected: the popup flow works exactly as before and lands on the same account and history.

- [ ] **Step 8: Report results and finish the branch**

Report what was observed at each step — especially Step 4 — before merging anything. Then use the `superpowers:finishing-a-development-branch` skill to decide how this branch integrates.

---

## Notes for the executor

- **Camera scanning cannot be tested here.** The simulator has no camera. Getting the app onto a real iPhone is free (personal-team provisioning, 7-day builds) but is a separate piece of work.
- **Sign in with Apple is out of scope** but is mandatory to ship on the App Store (Guideline 4.8, which requires it in any app offering Google sign-in). The same plugin provides `signInWithApple()` through the identical credential-provider pattern, and `appleProvider` already exists in `firebase.js`.
- **If the plugin's response shape differs from `result.credential.idToken`**, log the whole `result` object and adapt — the ID token is what matters, not the path to it. Do not fall back to letting the plugin sign in natively; that would split the source of auth truth, which is the thing this design exists to prevent.
