# Capacitor iOS Finish (Simulator-Ready) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the Capacitor 8 spike forward onto current `main` so the existing React/Vite app builds and runs in the iOS Simulator against the production Railway backend.

**Architecture:** Add Capacitor deps + `capacitor.config.json` to `web/`, regenerate the native `web/ios/` project from the current build, point the native build at the absolute Railway API URL, allow `capacitor://localhost` in backend CORS, add the camera usage string, and track `web/ios/`.

**Tech Stack:** Capacitor 8.5, Vite, React. Node 22 for Capacitor CLI + these builds; Express backend (`server/`).

## Global Constraints

- **Run every command in this plan under Node 22:** `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`. Verify with `node -v` → `v22.23.2`.
- `npm install` requires `--legacy-peer-deps` (pre-existing `@zxing/browser`↔`@zxing/library` peer mismatch).
- Capacitor config values (verbatim): `appId: app.ingredientscan`, `appName: IngredientScan`, `webDir: dist`.
- Production backend URL (verbatim): `https://precious-acceptance-production.up.railway.app`.
- CORS change is additive only — do not remove existing allowed origins.
- No web UI/logic changes; this is packaging + config + one backend line.

---

### Task 1: Add Capacitor deps + config to the web app

**Files:**
- Create: `web/capacitor.config.json`
- Modify: `web/package.json`

- [ ] **Step 1: Create `web/capacitor.config.json`**

```json
{
  "appId": "app.ingredientscan",
  "appName": "IngredientScan",
  "webDir": "dist"
}
```

- [ ] **Step 2: Add Capacitor deps + `build:ios` script to `web/package.json`**

Add to `"dependencies"`:
```json
    "@capacitor/core": "^8.5.0",
    "@capacitor/ios": "^8.5.0",
```
Add to `"devDependencies"`:
```json
    "@capacitor/cli": "^8.5.0",
```
Add to `"scripts"` (after `"build": "vite build"`):
```json
    "build:ios": "VITE_API_URL=https://precious-acceptance-production.up.railway.app vite build && cap sync ios",
```

- [ ] **Step 3: Install dependencies (Node 22)**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm install --legacy-peer-deps
```
Expected: installs `@capacitor/*`, updates `package-lock.json`, no fatal errors (peer warnings OK).

- [ ] **Step 4: Verify the CLI resolves**

Run: `cd web && npx cap --version`
Expected: prints `8.x`.

- [ ] **Step 5: Commit**

```bash
git add web/capacitor.config.json web/package.json web/package-lock.json
git commit -m "feat(ios): add Capacitor 8 deps, config, and build:ios script"
```

---

### Task 2: Generate the native iOS project from the current build

**Files:**
- Create: `web/ios/**` (generated), then track it via `.gitignore` change.
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `web/dist` (Vite build output), `web/capacitor.config.json` from Task 1.
- Produces: `web/ios/App/App/Info.plist` (Task 3 edits it), the Xcode project.

- [ ] **Step 1: Build the web app so `dist` exists (prod API URL)**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm run build:ios
```
Note: on the FIRST run `cap sync ios` will no-op/fail because the iOS platform isn't added yet — that's expected; the `vite build` half must succeed and produce `web/dist`. (If the script aborts on the `cap sync` half, that's fine for this step; proceed to add the platform next.)

- [ ] **Step 2: Add the iOS platform**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npx cap add ios
```
Expected: creates `web/ios/` with the Xcode project (`App` target) and copies `dist` into `ios/App/App/public/`.

- [ ] **Step 3: Sync**

Run: `cd web && npx cap sync ios`
Expected: "Sync finished" with no errors.

- [ ] **Step 4: Un-ignore `web/ios/` in the root `.gitignore`**

The root `.gitignore` has a broad `ios/` rule (line 5) that also hides `web/ios/`. Add immediately after that line:
```
!web/ios/
```

- [ ] **Step 5: Verify the project is now trackable**

Run: `git status --short web/ios | head`
Expected: `web/ios/...` files show as untracked (`??`). If they do NOT appear (negation didn't take), force-add in the next step with `git add -f web/ios`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git add web/ios || git add -f web/ios
git commit -m "feat(ios): generate Capacitor iOS project; track web/ios"
```

---

### Task 3: Add the camera usage description to Info.plist

**Files:**
- Modify: `web/ios/App/App/Info.plist`

- [ ] **Step 1: Read the current Info.plist**

Run: `cat web/ios/App/App/Info.plist`
Locate the top-level `<dict>` (inside `<plist>`).

- [ ] **Step 2: Add the camera usage key**

Insert this key/value pair inside the top-level `<dict>` (e.g., right after the opening `<dict>`):
```xml
	<key>NSCameraUsageDescription</key>
	<string>IngredientScan uses the camera to scan product barcodes and menus.</string>
```

- [ ] **Step 3: Verify it parses**

Run: `plutil -lint web/ios/App/App/Info.plist`
Expected: `web/ios/App/App/Info.plist: OK`

- [ ] **Step 4: Commit**

```bash
git add web/ios/App/App/Info.plist
git commit -m "feat(ios): add NSCameraUsageDescription for the scanner"
```

---

### Task 4: Allow `capacitor://localhost` in backend CORS

**Files:**
- Modify: `server/index.js`
- Test: `server/` existing test suite (`node --test`)

**Interfaces:**
- Consumes: existing `allowedOrigins` array + `cors` middleware.
- Produces: native app API calls (`Origin: capacitor://localhost`) pass CORS.

- [ ] **Step 1: Add the origin**

In `server/index.js`, change the `allowedOrigins` array from:
```js
const allowedOrigins = [
  'https://ingredientscan.app',
  'https://scanner.joelrog.com',
  'http://localhost:5173',
];
```
to:
```js
const allowedOrigins = [
  'https://ingredientscan.app',
  'https://scanner.joelrog.com',
  'http://localhost:5173',
  'capacitor://localhost', // native iOS app (Capacitor)
];
```

- [ ] **Step 2: Run the server test suite (Node 20 or 22)**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd server && node --test
```
Expected: all existing tests pass (same count as before; CORS is inline middleware, not unit-covered — this step guards against regressions).

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(ios): allow capacitor://localhost origin in backend CORS"
```

---

### Task 5: Final verification

- [ ] **Step 1: Clean native build under Node 22**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd web && npm run build:ios
```
Expected: `vite build` clean AND `cap sync ios` → "Sync finished" (now that the platform exists).

- [ ] **Step 2: Confirm the prod API URL is baked into the bundle**

Run: `grep -rl "precious-acceptance-production" web/ios/App/App/public/assets | head`
Expected: at least one built JS asset contains the Railway URL (proves the native bundle targets prod, not localhost).

- [ ] **Step 3: Report the manual simulator steps to the user**

The remaining verification is user-driven and needs the CoreSimulator runtime Software Update:
```bash
cd web && npx cap open ios   # opens Xcode → select a simulator → Run
```
Confirm in the simulator: app loads, Google login, Home/History/Lists/Profiles render, a history detail rematch round-trips against prod (proves CORS + API URL). Camera scan is expected to be unavailable in the simulator.

---

## Self-Review

- **Spec coverage:** deps+config+script (Task 1), regenerate ios + track (Task 2), camera perm (Task 3), CORS (Task 4), build/verify + simulator handoff (Task 5). All spec files covered.
- **Placeholder scan:** none — concrete code/commands throughout.
- **Consistency:** `build:ios` script, `capacitor://localhost`, and the Railway URL are identical across the spec and every task. Node 22 required for all Capacitor commands; server tests may run on Node 20.
- **Note:** Task 2 Step 1's `build:ios` will fail on its `cap sync` half before the platform exists — called out explicitly so the executor doesn't treat it as a blocker.
