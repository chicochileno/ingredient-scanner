# UI Redesign Sub-project 1 — Nav Shell + Home Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app's core into a green-forward chrome with a persistent bottom-tab navigation shell + center scan FAB, and rebuild Home as a dashboard (account popover, free-tier upgrade banner, Family Profiles card row, independently-scrolling Scan History grid).

**Architecture:** A React Router v7 **layout route** renders an `AppShell` (`<Outlet/>` + deep-green `BottomNav` with a scan FAB) around the four tab routes. The rebuilt `HomeScreen` composes pure view-model helpers (`homeModel.js`), a `useRecentScans` hook, an `AccountMenu` popover, and the existing `useProfiles`/`useBilling` data. The profile editor moves to its own deep route `/profiles/:profileId` outside the shell.

**Tech Stack:** React (Vite ESM), React Router v7 (layout routes / `<Outlet>` / `useLocation` / `useNavigate`), Firebase Firestore, `node --test` for pure helpers.

**Spec:** `docs/superpowers/specs/2026-08-19-ui-redesign-1-shell-home-design.md`

## Global Constraints

- **Node 20 required** — the PATH `node` is v12. Prefix `node`/`npm`/`npx` with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`. `npm install` (none needed here) would use `dangerouslyDisableSandbox: true`.
- **Green tokens, not navy:** deep-green chrome uses `--sage-deep` (#2E4B33) with white content; "Safe" pills use `--safe` (#256B38 on `--safe-light`); "Flagged" uses `--danger` on `--danger-light`. Fonts stay Bricolage Grotesque (display) / DM Sans (body).
- **Bottom nav only on the 4 tabs** (Home/History/Profile/Lists). Deep screens (Scan, Results, Menu results, Profile editor, Support, Upgrade, Login, Terms, Privacy) render without it.
- **WCAG 2.1 AA:** labeled `<nav>` with `aria-current`, focus-managed popover, text-labeled pills, ≥44px targets, verified contrast.
- **Scope = phase 1.** Do not restyle History/Profiles-list/Lists/Results/etc. internals; they render inside the shell as-is (a temporary visual seam is expected). Only navigation plumbing to those screens may change.
- **Deploy = push to `main`** auto-deploys frontend + backend. No Firestore rules change in this sub-project.

---

## Task 1: Theming — chrome token + green consolidation

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/src/MenuResultsScreen.css`, `web/src/TermsGate.css`, `web/src/SupportScreen.css`, `web/src/LoginScreen.css`, `web/src/HomeScreen.css`

**Interfaces:**
- Produces: a `--on-chrome` token; all app CSS references green via tokens (no new visuals).

- [ ] **Step 1: Add the chrome token**

In `web/src/index.css`, inside the `:root {` block, add after the `--sage-light` line:
```css
  --on-chrome: #FFFFFF;
```

- [ ] **Step 2: Replace drifted hardcoded greens with tokens**

Replace every occurrence of the hardcoded greens with the nearest token, in these files:
- `#4a7c59` → `var(--sage)`
- `#2f6b46` → `var(--sage)`
- `#265c36` / `#256c36` (if present) → `var(--safe)`

Run this to find them, then edit each hit:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
grep -rnE "#4a7c59|#2f6b46|#265c36" MenuResultsScreen.css TermsGate.css SupportScreen.css LoginScreen.css HomeScreen.css
```
For each match, replace the literal hex with the token above (e.g. `background: var(--sage);`). Do not change layout or other colors.

- [ ] **Step 3: Verify no hardcoded greens remain and build is clean**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
grep -rnE "#4a7c59|#2f6b46" src/*.css && echo "STILL PRESENT" || echo "clean"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `clean`; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/index.css web/src/*.css
git commit -m "refactor(ui): add --on-chrome token, consolidate greens onto tokens"
```

---

## Task 2: Pure Home view-model helpers

**Files:**
- Create: `web/src/homeModel.js`
- Test: `web/src/homeModel.test.js`

**Interfaces:**
- Produces:
  - `profileAvatar(profile) -> { initial, color }`
  - `scanCardModel(scan) -> { name, imageUrl, status, label }` where `status` ∈ `'safe' | 'flagged'`.

- [ ] **Step 1: Write the failing test**

Create `web/src/homeModel.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { profileAvatar, scanCardModel } from './homeModel.js';

test('profileAvatar: initial from name, deterministic color', () => {
  const a = profileAvatar({ id: 'p1', name: 'Mom', order: 0 });
  assert.strictEqual(a.initial, 'M');
  assert.match(a.color, /^#[0-9A-Fa-f]{6}$/);
  // deterministic: same profile → same color
  assert.strictEqual(profileAvatar({ id: 'p1', name: 'Mom', order: 0 }).color, a.color);
});

test('profileAvatar: fallback initial when no name', () => {
  assert.strictEqual(profileAvatar({ id: 'x', name: null, order: 2 }).initial, '?');
  assert.strictEqual(profileAvatar({ id: 'x' }).initial, '?');
});

test('scanCardModel: product name + safe when no flags', () => {
  const m = scanCardModel({ productName: 'Almond Milk', imageUrl: 'u', flagged: [], mode: 'barcode' });
  assert.strictEqual(m.name, 'Almond Milk');
  assert.strictEqual(m.imageUrl, 'u');
  assert.strictEqual(m.status, 'safe');
  assert.strictEqual(m.label, 'Safe');
});

test('scanCardModel: flagged with count', () => {
  const m = scanCardModel({ productName: 'Cereal', flagged: [{ severity: 'high' }, { severity: 'low' }], mode: 'camera' });
  assert.strictEqual(m.status, 'flagged');
  assert.strictEqual(m.label, 'Flagged (2)');
});

test('scanCardModel: mode-based name fallback', () => {
  assert.strictEqual(scanCardModel({ mode: 'barcode', flagged: [] }).name, 'Barcode scan');
  assert.strictEqual(scanCardModel({ mode: 'camera', flagged: [] }).name, 'Label scan');
  assert.strictEqual(scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [] } }).name, 'Menu scan');
});

test('scanCardModel: menu scan flagged from snapshot', () => {
  const safe = scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [{ flaggedCount: 0 }] } });
  assert.strictEqual(safe.status, 'safe');
  const flagged = scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [{ flaggedCount: 3 }, { flaggedCount: 0 }] } });
  assert.strictEqual(flagged.status, 'flagged');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/homeModel.test.js`
Expected: FAIL — `Cannot find module './homeModel.js'`.

- [ ] **Step 3: Implement `homeModel.js`**

Create `web/src/homeModel.js`:
```js
// Pure view-model helpers for the Home dashboard. No IO — unit-tested.

const AVATAR_COLORS = ['#2E4B33', '#256B38', '#3F6B4A', '#5A6250', '#8A4B0A', '#6B4A2E'];

// Deterministic avatar: first letter of name (or '?'), color chosen by a stable
// hash of the profile id (falls back to order) so it never changes for a profile.
export function profileAvatar(profile = {}) {
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const initial = name ? name[0].toUpperCase() : '?';
  const key = String(profile.id ?? profile.order ?? '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return { initial, color };
}

// View model for a Home history card. status is 'safe' | 'flagged'.
export function scanCardModel(scan = {}) {
  const modeName =
    scan.mode === 'menu' ? 'Menu scan' : scan.mode === 'barcode' ? 'Barcode scan' : 'Label scan';
  const name = scan.productName || modeName;
  const imageUrl = scan.imageUrl || null;

  let flaggedCount;
  if (scan.mode === 'menu') {
    const profiles = scan.menuSnapshot?.profiles || [];
    flaggedCount = profiles.reduce((n, p) => n + (p.flaggedCount > 0 ? 1 : 0), 0);
  } else {
    flaggedCount = Array.isArray(scan.flagged) ? scan.flagged.length : 0;
  }
  const status = flaggedCount > 0 ? 'flagged' : 'safe';
  const label = status === 'safe' ? 'Safe' : `Flagged (${flaggedCount})`;
  return { name, imageUrl, status, label };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/homeModel.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/homeModel.js web/src/homeModel.test.js
git commit -m "feat(ui): pure Home view-model helpers (profileAvatar, scanCardModel)"
```

---

## Task 3: `useRecentScans` hook

**Files:**
- Create: `web/src/useRecentScans.js`

**Interfaces:**
- Produces: `useRecentScans(user, max = 8) -> { scans, loading }` — newest-first array from `users/{uid}/scans`.

- [ ] **Step 1: Implement the hook**

Create `web/src/useRecentScans.js`:
```js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Live newest-first recent scans for the Home dashboard grid.
export function useRecentScans(user, max = 8) {
  const [state, setState] = useState({ scans: [], loading: true });

  useEffect(() => {
    if (!user) {
      setState({ scans: [], loading: false });
      return;
    }
    const q = query(
      collection(db, 'users', user.uid, 'scans'),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setState({ scans: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('Failed to load recent scans:', err);
        setState({ scans: [], loading: false });
      }
    );
    return unsub;
  }, [user?.uid, max]);

  return state;
}
```

- [ ] **Step 2: Verify it compiles (imported in a later task; sanity-parse now)**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --check src/useRecentScans.js && echo "parse ok"`
Expected: `parse ok`.

- [ ] **Step 3: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/useRecentScans.js
git commit -m "feat(ui): useRecentScans hook for Home history grid"
```

---

## Task 4: Navigation shell (AppShell + BottomNav + layout route)

**Files:**
- Create: `web/src/BottomNav.jsx`, `web/src/BottomNav.css`
- Create: `web/src/AppShell.jsx`, `web/src/AppShell.css`
- Modify: `web/src/App.jsx`

**Interfaces:**
- Consumes: `useNavigate`, `useLocation`, `Outlet` from `react-router-dom`.
- Produces: `default export AppShell` (renders `<Outlet/>` + `<BottomNav/>`); `default export BottomNav`.

- [ ] **Step 1: Create `BottomNav.jsx`**

Create `web/src/BottomNav.jsx`:
```jsx
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { to: '/home', label: 'Home', icon: (
    <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />
  ) },
  { to: '/history', label: 'History', icon: (
    <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
  ) },
  { to: '/profiles', label: 'Profile', icon: (
    <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>
  ) },
  { to: '/lists', label: 'Lists', icon: (
    <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>
  ) },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottomnav" aria-label="Main">
      <div className="bottomnav-tabs">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.to} tab={t} active={pathname === t.to} onClick={() => navigate(t.to)} />
        ))}
        <button className="bottomnav-fab" aria-label="Scan" onClick={() => navigate('/scan')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10" />
          </svg>
        </button>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.to} tab={t} active={pathname === t.to} onClick={() => navigate(t.to)} />
        ))}
      </div>
    </nav>
  );
}

function TabButton({ tab, active, onClick }) {
  return (
    <button
      className={`bottomnav-tab ${active ? 'bottomnav-tab-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tab.icon}
      </svg>
      <span className="bottomnav-label">{tab.label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Create `BottomNav.css`**

Create `web/src/BottomNav.css`:
```css
.bottomnav {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: var(--sage-deep);
  color: var(--on-chrome);
  padding-bottom: env(safe-area-inset-bottom, 0);
  z-index: 40;
}
.bottomnav-tabs {
  display: flex;
  align-items: center;
  justify-content: space-around;
  max-width: 560px;
  margin: 0 auto;
  height: 64px;
  position: relative;
}
.bottomnav-tab {
  flex: 1;
  min-height: 48px;
  background: none;
  border: none;
  color: rgba(255,255,255,.65);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font: inherit;
  cursor: pointer;
}
.bottomnav-tab-active { color: var(--on-chrome); }
.bottomnav-label { font-size: 0.7rem; }
.bottomnav-tab:focus-visible, .bottomnav-fab:focus-visible {
  outline: 2px solid var(--on-chrome);
  outline-offset: 2px;
  border-radius: 8px;
}
.bottomnav-fab {
  width: 60px; height: 60px;
  margin: 0 8px;
  border-radius: 50%;
  background: var(--sage);
  color: var(--on-chrome);
  border: 4px solid var(--bg);
  display: flex; align-items: center; justify-content: center;
  transform: translateY(-14px);
  box-shadow: var(--shadow);
  cursor: pointer;
  flex: none;
}
```

- [ ] **Step 3: Create `AppShell.jsx` + `AppShell.css`**

Create `web/src/AppShell.jsx`:
```jsx
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import './AppShell.css';

export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-shell-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
```

Create `web/src/AppShell.css`:
```css
.app-shell {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.app-shell-content {
  flex: 1;
  min-height: 0;            /* allow inner regions to scroll */
  padding-bottom: 64px;     /* clear the fixed bottom nav */
  overflow: hidden;
}
```

- [ ] **Step 4: Wire the layout route in `App.jsx`**

In `web/src/App.jsx`, add imports near the other screen imports:
```jsx
import AppShell from './AppShell';
```
Then wrap the four tab routes in a layout route. Replace the existing `/home`, `/history`, `/profiles`, `/lists` `<Route>` blocks with a single parent route (keep each screen's props):
```jsx
        <Route element={<RequireAuth user={user} authReady={authReady}><AppShell /></RequireAuth>}>
          <Route
            path="/home"
            element={
              <HomeRoute
                user={user}
                onScan={() => navigate('/scan')}
                onHistory={() => navigate('/history')}
                onProfiles={() => navigate('/profiles')}
                onLists={() => navigate('/lists')}
                onUpgrade={() => navigate('/upgrade')}
                onSupport={() => navigate('/support')}
              />
            }
          />
          <Route path="/history" element={<HistoryScreen user={user} onBack={() => navigate('/home')} onSelect={(scan) => navigate(`/history/${scan.id}`, { state: { scan } })} />} />
          <Route path="/profiles" element={<ProfilesScreen onBack={() => navigate('/home')} />} />
          <Route path="/lists" element={<ListsScreen onBack={() => navigate('/home')} onOpen={(id) => navigate(`/lists/${id}`)} />} />
        </Route>
```
Leave the other routes (`/scan`, `/results`, `/menu-results`, `/history/:scanId`, `/lists/:listId`, `/support`, `/upgrade`, `/upgrade/success`, public + gate) exactly as they are — they render outside the shell.

> Note: `HomeRoute`, `HistoryScreen`, `ProfilesScreen`, `ListsScreen` keep their current prop shapes; only their routing wrapper changes. The tab screens keep their existing back buttons for now (restyled in a later sub-project).

- [ ] **Step 5: Verify the build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/BottomNav.jsx web/src/BottomNav.css web/src/AppShell.jsx web/src/AppShell.css web/src/App.jsx
git commit -m "feat(ui): bottom-tab navigation shell with scan FAB (layout route)"
```

---

## Task 5: Account popover (`AccountMenu`)

**Files:**
- Create: `web/src/AccountMenu.jsx`, `web/src/AccountMenu.css`

**Interfaces:**
- Consumes: `signOut`, `auth`; `useBillingContext`; `useNavigate`; `createCustomerPortalSession` from `./api`.
- Produces: `default export AccountMenu({ onClose, onAbout })` — a focus-managed menu anchored by the caller; calls `onClose()` on dismiss and `onAbout()` for "How are ingredients flagged".

- [ ] **Step 1: Create `AccountMenu.jsx`**

Create `web/src/AccountMenu.jsx`:
```jsx
import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { useBillingContext } from './useBilling';
import { createCustomerPortalSession } from './api';
import './AccountMenu.css';

export default function AccountMenu({ onClose, onAbout }) {
  const navigate = useNavigate();
  const { subscriptionStatus } = useBillingContext();
  const isSubscribed = subscriptionStatus === 'active';
  const ref = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (firstItemRef.current) firstItemRef.current.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll('button');
        if (!items || items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  async function manageSubscription() {
    try {
      const { url } = await createCustomerPortalSession();
      if (url) window.location.href = url;
    } catch (e) { console.error('Portal error:', e); }
  }

  return (
    <div className="account-menu" role="menu" ref={ref}>
      <button ref={firstItemRef} role="menuitem" className="account-item" onClick={() => signOut(auth)}>Sign out</button>
      {isSubscribed && (
        <button role="menuitem" className="account-item" onClick={manageSubscription}>Manage subscription</button>
      )}
      <div className="account-divider" />
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/terms'); }}>Terms of Service</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/privacy'); }}>Privacy Policy</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); onAbout(); }}>How are ingredients flagged</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/support'); }}>Support</button>
    </div>
  );
}
```

- [ ] **Step 2: Create `AccountMenu.css`**

Create `web/src/AccountMenu.css`:
```css
.account-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  min-width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 60;
}
.account-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  font: inherit;
  color: var(--ink);
  padding: 12px 12px;
  min-height: 44px;
  border-radius: 10px;
  cursor: pointer;
}
.account-item:hover, .account-item:focus-visible { background: var(--sage-light); outline: none; }
.account-item-sub { color: var(--muted); font-size: 0.92rem; padding: 10px 12px; min-height: 40px; }
.account-divider { height: 1px; background: var(--border); margin: 6px 4px; }
```

- [ ] **Step 3: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/AccountMenu.jsx web/src/AccountMenu.css
git commit -m "feat(ui): account popover menu (sign out, subscription, legal, support)"
```

---

## Task 6: Profile editor as a deep route

**Files:**
- Modify: `web/src/useProfiles.js` (return new id from `addProfile`)
- Modify: `web/src/ProfilesScreen.jsx` (navigate to the editor route)
- Modify: `web/src/App.jsx` (add `/profiles/:profileId` route outside the shell)

**Interfaces:**
- Produces: route `/profiles/:profileId` rendering `ProfileEditor` for that profile (chrome-free); `addProfile(name) -> Promise<string>` (new id).

- [ ] **Step 1: Make `addProfile` return the new id**

In `web/src/useProfiles.js`, change:
```js
  async function addProfile(name) {
    await addDoc(collection(db, 'users', user.uid, 'profiles'), {
      name: name?.trim() || null,
      activeCategories: CATEGORY_KEYS,
      order: profiles.length,
      createdAt: serverTimestamp(),
    });
  }
```
to:
```js
  async function addProfile(name) {
    const ref = await addDoc(collection(db, 'users', user.uid, 'profiles'), {
      name: name?.trim() || null,
      activeCategories: CATEGORY_KEYS,
      order: profiles.length,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
```

- [ ] **Step 2: Add a `ProfileEditorRoute` in `App.jsx`**

In `web/src/App.jsx`, add an import:
```jsx
import ProfileEditor from './ProfileEditor';
```
Add this route component near the other route helpers (e.g. after `MenuResultsRoute`). Profiles come from `useProfileContext` (from `./useProfiles`):
```jsx
function ProfileEditorRoute() {
  const navigate = useNavigate();
  const { profileId } = useParams();
  const { profiles } = useProfileContext();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return <Navigate to="/profiles" replace />;
  return <ProfileEditor profile={profile} onClose={() => navigate('/profiles')} />;
}
```
Ensure `useProfileContext` and `useParams` are imported at the top of `App.jsx` (add to the existing `react-router-dom` and `./useProfiles` imports if missing):
```jsx
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useProfiles, ProfileContext, useProfileContext } from './useProfiles';
```
Then register the route **outside** the shell (alongside `/support`), so the editor is chrome-free:
```jsx
        <Route
          path="/profiles/:profileId"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ProfileEditorRoute />
            </RequireAuth>
          }
        />
```

- [ ] **Step 3: Point `ProfilesScreen` list rows at the route**

In `web/src/ProfilesScreen.jsx`, replace the internal editing state with navigation. Change the top:
```jsx
import { useState } from 'react';
```
to also import navigation:
```jsx
import { useNavigate } from 'react-router-dom';
```
Replace:
```jsx
export default function ProfilesScreen({ onBack }) {
  const { profiles, addProfile } = useProfileContext();
  const [editingId, setEditingId] = useState(null);
  const editing = profiles.find((p) => p.id === editingId);

  if (editing) return <ProfileEditor profile={editing} onClose={() => setEditingId(null)} />;
```
with:
```jsx
export default function ProfilesScreen({ onBack }) {
  const { profiles, addProfile } = useProfileContext();
  const navigate = useNavigate();
```
Then update the two call sites that used `setEditingId`:
- the row/card click handler → `navigate(\`/profiles/${p.id}\`)`
- the add handler `await addProfile('')` → `const id = await addProfile(''); navigate(\`/profiles/${id}\`)`

Remove the now-unused `ProfileEditor` import and `useState` import from `ProfilesScreen.jsx` if nothing else uses them.

- [ ] **Step 4: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/useProfiles.js web/src/ProfilesScreen.jsx web/src/App.jsx
git commit -m "feat(ui): profile editor as deep route /profiles/:profileId"
```

---

## Task 7: Home dashboard rebuild

**Files:**
- Rewrite: `web/src/HomeScreen.jsx`, `web/src/HomeScreen.css`

**Interfaces:**
- Consumes: `useProfileContext`, `useBillingContext`, `useRecentScans`, `homeModel`, `AccountMenu`; props `{ user, onScan, onUpgrade }` plus navigation via `useNavigate`.

- [ ] **Step 1: Rewrite `HomeScreen.jsx`**

Replace the entire contents of `web/src/HomeScreen.jsx` with:
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from './useProfiles';
import { useBillingContext } from './useBilling';
import { useRecentScans } from './useRecentScans';
import { profileAvatar, scanCardModel } from './homeModel';
import AccountMenu from './AccountMenu';
import './HomeScreen.css';

function AboutSheet({ onClose }) {
  return (
    <div className="about-sheet" role="dialog" aria-modal="true" aria-label="How are ingredients flagged">
      <div className="about-card">
        <h2 className="about-title">How are ingredients flagged?</h2>
        <p>Each profile has a set of ingredient categories to watch for. When you scan a product or menu, we check the ingredients against every profile's list and flag anything that matches — always as guidance, not a guarantee.</p>
        <button className="about-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function HomeScreen({ user, onUpgrade }) {
  const navigate = useNavigate();
  const { profiles } = useProfileContext();
  const { scanCount, subscriptionStatus, loading: billingLoading } = useBillingContext();
  const { scans } = useRecentScans(user, 8);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const isSubscribed = subscriptionStatus === 'active';
  const atLimit = !isSubscribed && scanCount >= 10;

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-brand">IngredientScan</div>
        <div className="home-account">
          <button className="home-avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {user.photoURL
              ? <img className="home-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              : <span className="home-avatar home-avatar-fallback">{(user.displayName || '?')[0]}</span>}
          </button>
          {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} onAbout={() => setShowAbout(true)} />}
        </div>
      </header>

      {!isSubscribed && !billingLoading && (
        <button className="home-upgrade" onClick={onUpgrade}>
          <span className="home-upgrade-text">{atLimit ? 'Free scans used up' : `${scanCount} of 10 free scans used`}</span>
          <span className="home-upgrade-cta">Upgrade</span>
          <span className="home-upgrade-bar"><span className="home-upgrade-fill" style={{ width: `${Math.min((scanCount / 10) * 100, 100)}%` }} /></span>
        </button>
      )}

      <section className="home-profiles" aria-label="Family profiles">
        <h2 className="home-section-title">Family Profiles</h2>
        <div className="home-profiles-row">
          {profiles.map((p) => {
            const av = profileAvatar(p);
            const cats = (p.activeCategories || []).length;
            return (
              <button key={p.id} className="profile-card" onClick={() => navigate(`/profiles/${p.id}`)}>
                <span className="profile-avatar" style={{ background: av.color }}>{av.initial}</span>
                <span className="profile-name">{p.name || 'Unnamed'}</span>
                <span className="profile-summary">{cats > 0 ? `${cats} categor${cats === 1 ? 'y' : 'ies'}` : 'None'}</span>
              </button>
            );
          })}
          <AddProfileCard onAdded={(id) => navigate(`/profiles/${id}`)} />
        </div>
      </section>
      {/* AddProfileCard is defined at the bottom of this file */}

      <section className="home-history" aria-label="Scan history">
        <div className="home-history-head">
          <h2 className="home-section-title">Scan History</h2>
          <button className="home-viewall" onClick={() => navigate('/history')}>View All</button>
        </div>
        <div className="home-history-scroll">
          {scans.length === 0 ? (
            <p className="home-empty">No scans yet — tap the scan button below to check your first product.</p>
          ) : (
            <div className="home-history-grid">
              {scans.map((s) => {
                const m = scanCardModel(s);
                return (
                  <button key={s.id} className="scan-card" onClick={() => navigate(`/history/${s.id}`, { state: { scan: s } })}>
                    <span className="scan-card-img">
                      {m.imageUrl ? <img src={m.imageUrl} alt="" /> : <span className="scan-card-noimg">{s.mode === 'barcode' ? '▦' : s.mode === 'menu' ? '≣' : '⊟'}</span>}
                    </span>
                    <span className="scan-card-name">{m.name}</span>
                    <span className={`scan-pill scan-pill-${m.status}`}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function AddProfileCard({ onAdded }) {
  const { addProfile } = useProfileContext();
  return (
    <button className="profile-card profile-card-add" onClick={async () => onAdded(await addProfile(''))}>
      <span className="profile-avatar profile-avatar-add">+</span>
      <span className="profile-name">Add profile</span>
    </button>
  );
}
```
> Delete the stray `addProfileAndEdit` / `profilesAddRef` lines above — they are replaced by the `AddProfileCard` component. Final file must not reference `profilesAddRef`.

- [ ] **Step 2: Rewrite `HomeScreen.css`**

Replace the entire contents of `web/src/HomeScreen.css` with:
```css
.home { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); }
.home-header {
  background: var(--sage-deep);
  color: var(--on-chrome);
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top, 0));
}
.home-brand { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; }
.home-account { position: relative; }
.home-avatar-btn { background: none; border: none; padding: 0; cursor: pointer; border-radius: 50%; }
.home-avatar-btn:focus-visible { outline: 2px solid var(--on-chrome); outline-offset: 2px; }
.home-avatar { width: 34px; height: 34px; border-radius: 50%; display: block; object-fit: cover; }
.home-avatar-fallback { background: var(--sage); color: var(--on-chrome); display: flex; align-items: center; justify-content: center; font-weight: 600; }

.home-upgrade {
  margin: 12px 16px 0; padding: 10px 14px;
  background: var(--sage-light); border: 1px solid var(--border); border-radius: var(--radius-sm);
  display: grid; grid-template-columns: 1fr auto; grid-row-gap: 8px; align-items: center;
  font: inherit; color: var(--ink); text-align: left; cursor: pointer;
}
.home-upgrade-cta { color: var(--sage-deep); font-weight: 700; }
.home-upgrade-bar { grid-column: 1 / -1; height: 6px; background: var(--border); border-radius: 999px; overflow: hidden; }
.home-upgrade-fill { display: block; height: 100%; background: var(--sage); }

.home-section-title { font-family: var(--font-display); font-size: 1.15rem; margin: 0; }
.home-profiles { padding: 16px 0 8px; }
.home-profiles .home-section-title { padding: 0 16px 10px; }
.home-profiles-row { display: flex; gap: 12px; overflow-x: auto; padding: 0 16px 4px; }
.profile-card {
  flex: 0 0 auto; width: 120px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
  box-shadow: var(--shadow); padding: 14px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font: inherit; cursor: pointer;
}
.profile-avatar { width: 44px; height: 44px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.profile-avatar-add { background: var(--sage-light); color: var(--sage-deep); }
.profile-name { font-weight: 600; }
.profile-summary { color: var(--muted); font-size: 0.82rem; }
.profile-card-add { justify-content: center; color: var(--muted); }

.home-history { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.home-history-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; }
.home-viewall { background: none; border: none; color: var(--sage-deep); font: inherit; font-weight: 600; cursor: pointer; }
.home-history-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 16px 16px; }
.home-history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.home-empty { color: var(--muted); padding: 20px 4px; }
.scan-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; padding: 0 0 10px; font: inherit; cursor: pointer; }
.scan-card-img { width: 100%; aspect-ratio: 16/10; background: var(--card); display: block; }
.scan-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.scan-card-noimg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: var(--muted); }
.scan-card-name { font-weight: 600; padding: 8px 10px 6px; text-align: left; }
.scan-pill { margin: 0 10px; padding: 3px 10px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
.scan-pill-safe { background: var(--safe-light); color: var(--safe); }
.scan-pill-flagged { background: var(--danger-light); color: var(--danger); }

.about-sheet { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; justify-content: center; z-index: 70; }
.about-card { width: 100%; max-width: 560px; background: var(--surface); border-radius: 20px 20px 0 0; padding: 22px; }
.about-title { font-family: var(--font-display); margin: 0 0 10px; }
.about-close { margin-top: 16px; width: 100%; padding: 14px; border: none; border-radius: 12px; background: var(--sage); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
```

- [ ] **Step 3: Verify the build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/HomeScreen.jsx web/src/HomeScreen.css
git commit -m "feat(ui): rebuild Home as dashboard (header, upgrade banner, profiles row, history grid)"
```

---

## Task 8: Full verification

- [ ] **Step 1: Unit tests + build**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/homeModel.test.js 2>&1 | grep -E "# pass|# fail"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: homeModel tests pass; build succeeds.

- [ ] **Step 2: Manual flow (signed-in session)**

- Bottom nav shows on Home/History/Profile/Lists with correct active tab; FAB opens the camera (`/scan`); nav is **absent** on Scan, Results, Menu results, Support, Upgrade, the profile editor, Terms, Privacy.
- Account avatar opens the popover; Esc and outside-click close it; each item routes correctly; "Manage subscription" appears only when subscribed; "How are ingredients flagged" opens the sheet; Support/Terms/Privacy navigate.
- Free user: upgrade banner shows count + progress and routes to `/upgrade`; subscriber: banner hidden.
- Profiles row: tap a card → `/profiles/:id` editor (chrome-free); "+ Add profile" creates and opens the editor; back returns to `/profiles`.
- Scan History: shows ≤ 8 newest, image + name + Safe/Flagged pill; the grid scrolls **independently** beneath the pinned header/banner/profiles; tapping a card opens its detail; empty state shows for a new account.

- [ ] **Step 3: Accessibility (manual + axe)**

- Bottom nav labeled with `aria-current` on the active tab; FAB labeled "Scan"; avatar button has `aria-haspopup`/`aria-expanded`.
- Popover: focus lands on the first item, Tab cycles within, Esc closes, focus returns to the avatar.
- Status pills carry text; white-on-deep-green and pill contrasts pass AA; the history region is keyboard-scrollable.

- [ ] **Step 4: Deploy note**

No Firestore rules change in this sub-project. Deploy is a normal push to `main` (frontend Firebase Hosting + backend Railway). Expect a visual seam between the new chrome/dashboard and the not-yet-restyled tab screens (History/Profiles list/Lists) — that's intended; they're restyled in Sub-project 2+.

---

## Self-Review

**Spec coverage:**
- Deep-green chrome tokens + green consolidation — Task 1 ✓
- Bottom-tab shell + scan FAB, layout route, on-4-tabs-only — Task 4 ✓
- Home header + account popover (sign out, manage-sub [subscribers only], terms/privacy/how-flagged/support) — Tasks 5, 7 ✓
- Free-tier upgrade banner (hidden for subscribers) — Task 7 ✓
- Family Profiles row, tap → editor, "+ Add profile" — Tasks 6, 7 ✓
- Profile editor as chrome-free deep route — Task 6 ✓
- Scan History up to 8, independent scroll under pinned header, View All, tap → detail, empty state — Task 7 ✓
- Pure helpers unit-tested (profileAvatar, scanCardModel); useRecentScans — Tasks 2, 3 ✓
- WCAG AA (nav labels/aria-current, popover focus mgmt, pill text, contrast) — Tasks 4, 5, 7, 8 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete, directly-usable code. `ProfileEditorRoute` (Task 6) and `AddProfileCard` (Task 7, defined at the bottom of `HomeScreen.jsx`) are single concrete implementations. `HomeScreen` uses `useNavigate` directly for all navigation.

**Type consistency:** `profileAvatar(profile) -> {initial,color}` and `scanCardModel(scan) -> {name,imageUrl,status,label}` (Task 2) are used with those exact shapes in Task 7. `useRecentScans(user,8) -> {scans,loading}` (Task 3) consumed as `{ scans }` in Task 7. `AccountMenu({onClose,onAbout})` (Task 5) rendered with those props in Task 7. `addProfile -> Promise<string>` (Task 6) awaited for the new id in Task 7's `AddProfileCard` and ProfilesScreen. Route `/profiles/:profileId` (Task 6) is the navigation target from Task 7's profile cards. `AppShell` wraps only the 4 tab routes (Task 4); the editor route is registered outside it (Task 6).
