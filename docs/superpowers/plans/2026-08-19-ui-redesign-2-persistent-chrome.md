# UI Redesign Sub-project 2 — Persistent Chrome + Scan-History Previews — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deep-green header + bottom nav persistent across all in-app screens (removing each screen's own header), constrain scan-history preview images (≤180px, letterboxed on dark gray), add per-scan mode badges, and fix Open Food Facts product photos so barcode scans show an image.

**Architecture:** `AppShell` becomes a fixed flex column of `AppHeader` (top) + scrolling content + `BottomNav` (bottom), and the layout route wraps all in-app routes (except `/scan`). `AppHeader` is contextual via a pure `headerForRoute(pathname)`. Screen roots switch from `position:fixed`/`100dvh` to `height:100%` so they sit in the framed content area; their own headers are removed.

**Tech Stack:** React (Vite ESM), React Router v7 (layout routes, `useLocation`), Firebase, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-19-ui-redesign-2-persistent-chrome-design.md`

## Global Constraints

- **Node 20 required** — prefix `node`/`npm`/`npx` with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Chrome-free exceptions:** Login (`/`), Terms gate, `/terms`, `/privacy`, and `/scan` render outside the shell. Everything else in-app gets header + nav.
- **Deep-green chrome** uses `--sage-deep` / `--on-chrome`; preview backdrop uses a new `--preview-bg`.
- **WCAG 2.1 AA:** header title + labeled back button; mode badge carries an `aria-label`; popover focus mgmt unchanged; contrast verified.
- **Scope:** chrome + preview polish + OFF fix only. Do **not** restyle screen bodies (later sub-project); expect an internal style seam per screen.
- **Deploy:** frontend-only, no Firestore rules change; normal push to `main`.

---

## Task 1: Pure helpers — `headerForRoute` + `scanModeBadge`

**Files:**
- Create: `web/src/headerModel.js`
- Test: `web/src/headerModel.test.js`
- Modify: `web/src/homeModel.js` (add `scanModeBadge`)
- Modify: `web/src/homeModel.test.js` (add cases)

**Interfaces:**
- Produces: `headerForRoute(pathname) -> { title, showLogo, backTo }`; `scanModeBadge(mode) -> { key, label }` where `key` ∈ `'barcode' | 'label' | 'menu'`.

- [ ] **Step 1: Write the failing `headerModel` test**

Create `web/src/headerModel.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { headerForRoute } from './headerModel.js';

test('tab routes: logo, no back', () => {
  for (const [p, title] of [['/home', 'IngredientScan'], ['/history', 'History'], ['/profiles', 'Profiles'], ['/lists', 'Lists']]) {
    const h = headerForRoute(p);
    assert.strictEqual(h.title, title);
    assert.strictEqual(h.showLogo, true);
    assert.strictEqual(h.backTo, null);
  }
});

test('deep routes: title + parent back, no logo', () => {
  assert.deepStrictEqual(headerForRoute('/results'), { title: 'Results', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/menu-results'), { title: 'Menu Results', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/support'), { title: 'Support', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/upgrade'), { title: 'Upgrade', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/upgrade/success'), { title: 'Upgrade', showLogo: false, backTo: '/home' });
});

test('dynamic routes: parent back', () => {
  assert.deepStrictEqual(headerForRoute('/history/abc'), { title: 'Scan', showLogo: false, backTo: '/history' });
  assert.deepStrictEqual(headerForRoute('/lists/xyz'), { title: 'List', showLogo: false, backTo: '/lists' });
  assert.deepStrictEqual(headerForRoute('/profiles/p1'), { title: 'Edit Profile', showLogo: false, backTo: '/profiles' });
});

test('unknown route: safe default', () => {
  assert.deepStrictEqual(headerForRoute('/whatever'), { title: '', showLogo: true, backTo: null });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/headerModel.test.js`
Expected: FAIL — `Cannot find module './headerModel.js'`.

- [ ] **Step 3: Implement `headerModel.js`**

Create `web/src/headerModel.js`:
```js
// Pure: derive the persistent header's content from the current path. No IO.
const TAB_TITLES = { '/home': 'IngredientScan', '/history': 'History', '/profiles': 'Profiles', '/lists': 'Lists' };
const EXACT = {
  '/results': { title: 'Results', backTo: '/home' },
  '/menu-results': { title: 'Menu Results', backTo: '/home' },
  '/support': { title: 'Support', backTo: '/home' },
  '/upgrade': { title: 'Upgrade', backTo: '/home' },
  '/upgrade/success': { title: 'Upgrade', backTo: '/home' },
};

export function headerForRoute(pathname) {
  if (TAB_TITLES[pathname]) return { title: TAB_TITLES[pathname], showLogo: true, backTo: null };
  if (EXACT[pathname]) return { title: EXACT[pathname].title, showLogo: false, backTo: EXACT[pathname].backTo };
  if (pathname.startsWith('/history/')) return { title: 'Scan', showLogo: false, backTo: '/history' };
  if (pathname.startsWith('/lists/')) return { title: 'List', showLogo: false, backTo: '/lists' };
  if (pathname.startsWith('/profiles/')) return { title: 'Edit Profile', showLogo: false, backTo: '/profiles' };
  return { title: '', showLogo: true, backTo: null };
}
```

- [ ] **Step 4: Add `scanModeBadge` to `homeModel.js`**

Append to `web/src/homeModel.js`:
```js
// Mode → badge descriptor for scan cards. key selects the icon; label is for a11y.
export function scanModeBadge(mode) {
  if (mode === 'barcode') return { key: 'barcode', label: 'Barcode scan' };
  if (mode === 'menu') return { key: 'menu', label: 'Menu scan' };
  return { key: 'label', label: 'Label scan' };
}
```

- [ ] **Step 5: Add `scanModeBadge` cases to `homeModel.test.js`**

Append to `web/src/homeModel.test.js`:
```js
import { scanModeBadge } from './homeModel.js';

test('scanModeBadge maps modes (camera/unknown → label)', () => {
  assert.deepStrictEqual(scanModeBadge('barcode'), { key: 'barcode', label: 'Barcode scan' });
  assert.deepStrictEqual(scanModeBadge('menu'), { key: 'menu', label: 'Menu scan' });
  assert.deepStrictEqual(scanModeBadge('camera'), { key: 'label', label: 'Label scan' });
  assert.deepStrictEqual(scanModeBadge(undefined), { key: 'label', label: 'Label scan' });
});
```
(The existing `import { profileAvatar, scanCardModel } from './homeModel.js';` line stays; this adds a second import for `scanModeBadge` — duplicate imports from the same module are valid ESM.)

- [ ] **Step 6: Run both tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/headerModel.test.js src/homeModel.test.js`
Expected: PASS (all cases).

- [ ] **Step 7: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/headerModel.js web/src/headerModel.test.js web/src/homeModel.js web/src/homeModel.test.js
git commit -m "feat(ui): headerForRoute + scanModeBadge pure helpers"
```

---

## Task 2: `AppHeader` component

Owns the global header: contextual logo/back/title, the account avatar → `AccountMenu` popover, and the About sheet (relocated from Home). Reads `auth.currentUser` and `useLocation` directly (no props).

**Files:**
- Create: `web/src/AppHeader.jsx`, `web/src/AppHeader.css`

**Interfaces:**
- Consumes: `auth`, `useLocation`, `useNavigate`, `headerForRoute`, `AccountMenu`.
- Produces: `default export AppHeader`.

- [ ] **Step 1: Create `AppHeader.jsx`**

Create `web/src/AppHeader.jsx`:
```jsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { headerForRoute } from './headerModel';
import AccountMenu from './AccountMenu';
import './AppHeader.css';

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

export default function AppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const { title, showLogo, backTo } = headerForRoute(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-left">
        {showLogo || !backTo ? (
          <span className="app-header-logo">{title || 'IngredientScan'}</span>
        ) : (
          <button className="app-header-back" aria-label="Back" onClick={() => navigate(backTo)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            <span className="app-header-title">{title}</span>
          </button>
        )}
      </div>
      <div className="app-header-account">
        <button className="app-header-avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          {user?.photoURL
            ? <img className="app-header-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            : <span className="app-header-avatar app-header-avatar-fallback">{(user?.displayName || '?')[0]}</span>}
        </button>
        {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} onAbout={() => setShowAbout(true)} />}
      </div>
      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
    </header>
  );
}
```

- [ ] **Step 2: Create `AppHeader.css`**

Create `web/src/AppHeader.css`:
```css
.app-header {
  flex: none;
  background: var(--sage-deep);
  color: var(--on-chrome);
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top, 0));
  min-height: 52px;
}
.app-header-left { display: flex; align-items: center; min-width: 0; }
.app-header-logo { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; }
.app-header-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--on-chrome); font: inherit; cursor: pointer; padding: 4px 0; }
.app-header-title { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; }
.app-header-back:focus-visible, .app-header-avatar-btn:focus-visible { outline: 2px solid var(--on-chrome); outline-offset: 2px; border-radius: 8px; }
.app-header-account { position: relative; }
.app-header-avatar-btn { background: none; border: none; padding: 0; cursor: pointer; border-radius: 50%; }
.app-header-avatar { width: 34px; height: 34px; border-radius: 50%; display: block; object-fit: cover; }
.app-header-avatar-fallback { background: var(--sage); color: var(--on-chrome); display: flex; align-items: center; justify-content: center; font-weight: 600; }

/* About sheet (relocated from Home) */
.about-sheet { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; justify-content: center; z-index: 70; }
.about-card { width: 100%; max-width: 560px; background: var(--surface); border-radius: 20px 20px 0 0; padding: 22px; }
.about-title { font-family: var(--font-display); margin: 0 0 10px; }
.about-close { margin-top: 16px; width: 100%; padding: 14px; border: none; border-radius: 12px; background: var(--sage); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
```

- [ ] **Step 3: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/AppHeader.jsx web/src/AppHeader.css
git commit -m "feat(ui): persistent AppHeader (contextual logo/back/title + account popover)"
```

---

## Task 3: AppShell frame + move routes into it + screen-root fixes

**Files:**
- Modify: `web/src/AppShell.jsx`, `web/src/AppShell.css`
- Modify: `web/src/BottomNav.css` (in-flow instead of fixed)
- Modify: `web/src/App.jsx` (move in-app routes into the layout route)
- Modify: `web/src/HistoryScreen.css`, `web/src/ResultsScreen.css`, `web/src/UpgradeScreen.css`, `web/src/ListsScreen.css`, `web/src/ProfilesScreen.css` (root height fixes)

- [ ] **Step 1: Make `AppShell` a header+content+nav frame**

Replace `web/src/AppShell.jsx` with:
```jsx
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import './AppShell.css';

export default function AppShell() {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-shell-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Update `AppShell.css` (in-flow chrome, no bottom padding)**

Replace `web/src/AppShell.css` with:
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
  min-height: 0;      /* let inner screens own their scroll */
  overflow: hidden;
}
```

- [ ] **Step 3: Make `BottomNav` in-flow**

In `web/src/BottomNav.css`, change the `.bottomnav` rule from:
```css
.bottomnav {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: var(--sage-deep);
  color: var(--on-chrome);
  padding-bottom: env(safe-area-inset-bottom, 0);
  z-index: 40;
}
```
to:
```css
.bottomnav {
  flex: none;
  background: var(--sage-deep);
  color: var(--on-chrome);
  padding-bottom: env(safe-area-inset-bottom, 0);
  z-index: 40;
}
```
(The FAB's `translateY(-14px)` still lifts it above the bar; as a flex sibling after the content it paints on top.)

- [ ] **Step 4: Fix screen roots to `height: 100%`**

Apply these exact CSS replacements so screens fit the framed content area instead of covering the chrome:

`web/src/HistoryScreen.css` — the `.hist-root` rule: replace `position: fixed;` + `inset: 0;` with `height: 100%;` (keep `display: flex; flex-direction: column;`). Concretely, change the block to start:
```css
.hist-root {
  height: 100%;
  display: flex;
  flex-direction: column;
```
(remove the `position: fixed;` and `inset: 0;` lines).

`web/src/ResultsScreen.css` — `.results-root`: same change (remove `position: fixed;`/`inset: 0;`, add `height: 100%;`).

`web/src/UpgradeScreen.css` — `.upgrade-root`: same change (remove `position: fixed;`/`inset: 0;`, add `height: 100%;`).

`web/src/ListsScreen.css` — `.lists-root`: change `height: 100dvh;` → `height: 100%;`.

`web/src/ProfilesScreen.css` — `.pe-root`: change `height:100dvh;` → `height:100%;`.

- [ ] **Step 5: Move in-app routes into the AppShell layout route**

In `web/src/App.jsx`, the AppShell layout route currently wraps only `/home`, `/history`, `/profiles`, `/lists`. Add the other in-app routes as children of that same `<Route element={<RequireAuth...><AppShell/></RequireAuth>}>` block, and remove their standalone definitions. Move these into the layout route (keep each element exactly as it is today, minus the outer `RequireAuth` wrapper since the shell provides it):
- `/results` → `<ResultsRoute />`
- `/menu-results` → `<MenuResultsRoute />`
- `/history/:scanId` → `<HistoryScanRoute user={user} />`
- `/lists/:listId` → `<ListDetailScreen user={user} onBack={() => navigate('/lists')} />`
- `/profiles/:profileId` → `<ProfileEditorRoute />`
- `/support` → `<SupportScreen onBack={() => navigate('/home')} />`
- `/upgrade` → `<UpgradeScreen onBack={() => navigate('/home')} />`
- `/upgrade/success` → `<UpgradeSuccessScreen />`

Leave `/scan` as a standalone chrome-free `<Route>` with its own `RequireAuth`. Leave public routes (`/`, `/s/:shareId`, `/terms`, `/privacy`) and the Terms gate exactly as they are.

The resulting layout-route block should read:
```jsx
        <Route element={<RequireAuth user={user} authReady={authReady}><AppShell /></RequireAuth>}>
          <Route path="/home" element={<HomeRoute user={user} onScan={() => navigate('/scan')} onHistory={() => navigate('/history')} onProfiles={() => navigate('/profiles')} onLists={() => navigate('/lists')} onUpgrade={() => navigate('/upgrade')} onSupport={() => navigate('/support')} />} />
          <Route path="/history" element={<HistoryScreen user={user} onBack={() => navigate('/home')} onSelect={(scan) => navigate(`/history/${scan.id}`, { state: { scan } })} />} />
          <Route path="/history/:scanId" element={<HistoryScanRoute user={user} />} />
          <Route path="/profiles" element={<ProfilesScreen onBack={() => navigate('/home')} />} />
          <Route path="/profiles/:profileId" element={<ProfileEditorRoute />} />
          <Route path="/lists" element={<ListsScreen onBack={() => navigate('/home')} onOpen={(id) => navigate(`/lists/${id}`)} />} />
          <Route path="/lists/:listId" element={<ListDetailScreen user={user} onBack={() => navigate('/lists')} />} />
          <Route path="/results" element={<ResultsRoute />} />
          <Route path="/menu-results" element={<MenuResultsRoute />} />
          <Route path="/support" element={<SupportScreen onBack={() => navigate('/home')} />} />
          <Route path="/upgrade" element={<UpgradeScreen onBack={() => navigate('/home')} />} />
          <Route path="/upgrade/success" element={<UpgradeSuccessScreen />} />
        </Route>
```
Remove the now-duplicated standalone `<Route>` blocks for `/results`, `/menu-results`, `/history/:scanId`, `/profiles/:profileId`, `/lists/:listId`, `/support`, `/upgrade`, `/upgrade/success`. Keep `/scan` standalone.

- [ ] **Step 6: Verify the build compiles and the app frames correctly**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds. (Screens now show BOTH the global header and their own header — that double header is removed in Tasks 4–5.)

- [ ] **Step 7: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/AppShell.jsx web/src/AppShell.css web/src/BottomNav.css web/src/App.jsx web/src/HistoryScreen.css web/src/ResultsScreen.css web/src/UpgradeScreen.css web/src/ListsScreen.css web/src/ProfilesScreen.css
git commit -m "feat(ui): persistent header+nav frame; all in-app routes in shell; root fits"
```

---

## Task 4: Remove per-screen headers — Home + tab screens

**Files:**
- Modify: `web/src/HomeScreen.jsx` (drop `.home-header` + its avatar/popover + local `AboutSheet`)
- Modify: `web/src/HomeScreen.css` (drop header styles; AboutSheet styles now live in AppHeader.css)
- Modify: `web/src/HistoryScreen.jsx` (drop `.hist-header`)
- Modify: `web/src/ProfilesScreen.jsx` (drop `.profiles-header`)
- Modify: `web/src/ListsScreen.jsx` (drop the `.lists-header` on the **list screen**; keep it on ListDetail — handled in Task 5)

- [ ] **Step 1: HomeScreen — remove its header, avatar, popover, and local AboutSheet**

In `web/src/HomeScreen.jsx`:
- Delete the entire `function AboutSheet({ onClose }) { ... }` definition (now in AppHeader).
- Remove the imports no longer used by Home: `AccountMenu` and `auth` are no longer referenced here — delete `import AccountMenu from './AccountMenu';` if present, and remove `menuOpen`/`showAbout` state.
- Remove the `<header className="home-header"> ... </header>` block (logo + avatar button + `AccountMenu`).
- Remove the trailing `{showAbout && <AboutSheet ... />}`.
- Keep everything else (upgrade banner, profiles row, history section). The component keeps `useNavigate`, `useProfileContext`, `useBillingContext`, `useRecentScans`, `profileAvatar`, `scanCardModel`.

The top of the returned JSX changes from `<div className="home"><header className="home-header">…</header>{upgrade…}` to `<div className="home">{upgrade…}` (the upgrade banner becomes the first child).

- [ ] **Step 2: HomeScreen.css — drop header + about styles**

In `web/src/HomeScreen.css`, delete the rules for `.home-header`, `.home-brand`, `.home-account`, `.home-avatar-btn`, `.home-avatar`, `.home-avatar-fallback`, `.about-sheet`, `.about-card`, `.about-title`, `.about-close` (the About styles now live in `AppHeader.css`). Keep all other Home styles (upgrade banner, profiles, history grid).

- [ ] **Step 3: HistoryScreen — remove its header**

In `web/src/HistoryScreen.jsx`, remove the header block:
```jsx
      <div className="hist-header">
        <button className="hist-back" onClick={onBack} aria-label="Back to home">
          ...
        </button>
        <h1 className="hist-title">History</h1>
      </div>
```
(Delete the whole `<div className="hist-header">…</div>`. The `onBack` prop becomes unused — that's fine; leave the prop in the signature to avoid touching App.jsx.)

- [ ] **Step 4: ProfilesScreen — remove its header**

In `web/src/ProfilesScreen.jsx`, remove:
```jsx
      <div className="profiles-header">
        <button className="profiles-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="profiles-title">Profiles</h1>
      </div>
```

- [ ] **Step 5: ListsScreen (list screen only) — remove its header**

In `web/src/ListsScreen.jsx`, in the **`ListsScreen`** component (not `ListDetailScreen`), remove:
```jsx
      <div className="lists-header">
        <button className="lists-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="lists-title">Lists</h1>
      </div>
```
Leave `ListDetailScreen`'s header for Task 5 (it contains the editable list-name input).

- [ ] **Step 6: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/HomeScreen.jsx web/src/HomeScreen.css web/src/HistoryScreen.jsx web/src/ProfilesScreen.jsx web/src/ListsScreen.jsx
git commit -m "feat(ui): remove per-screen headers on Home + tab screens (global header owns them)"
```

---

## Task 5: Remove per-screen headers — deep screens

**Files:**
- Modify: `web/src/ResultsScreen.jsx`, `web/src/MenuResultsScreen.jsx`, `web/src/SupportScreen.jsx`, `web/src/ProfileEditor.jsx`, `web/src/UpgradeScreen.jsx`, `web/src/ListsScreen.jsx` (ListDetail back button only)

- [ ] **Step 1: ResultsScreen — remove the back button**

In `web/src/ResultsScreen.jsx`, remove the `{onBack && ( ... )}` back-button block (the one rendering `results-back`). Keep the rest of the results header content (product name / source line). Leave `onBack` in the signature.

- [ ] **Step 2: MenuResultsScreen — remove the back button**

In `web/src/MenuResultsScreen.jsx`, remove the `{onBack && (<button className="results-back" ...>...</button>)}` block. Keep the caveat banner and everything else.

- [ ] **Step 3: SupportScreen — remove back button + redundant title**

In `web/src/SupportScreen.jsx`, remove the `{onBack && (<button className="support-back">…</button>)}` block and the `<h1 className="support-title">Support</h1>` (the global header now shows "Support"). Keep the form / sent state. (The success-state "Back to app" button uses `onBack` — keep that button; `onBack` navigates home.)

- [ ] **Step 4: ProfileEditor — remove its header**

In `web/src/ProfileEditor.jsx`, remove:
```jsx
      <div className="pe-header">
        <button className="pe-back" onClick={onClose} aria-label="Back to profiles">‹ Back</button>
        <h1 className="pe-title">Edit profile</h1>
      </div>
```
(`onClose` is still used elsewhere if present; leave the prop. The global header's back returns to `/profiles`.)

- [ ] **Step 5: UpgradeScreen — remove the back button**

In `web/src/UpgradeScreen.jsx`, remove the `<button className="upgrade-back" onClick={onBack}>…</button>` element. Keep the upgrade content/title/body.

- [ ] **Step 6: ListDetailScreen — remove only the back button (keep the name input)**

In `web/src/ListsScreen.jsx`, in **`ListDetailScreen`**, the `.lists-header` holds both a back button and the `.ld-name` input. Remove **only** the back button:
```jsx
        <button className="lists-back" onClick={onBack} aria-label="Back to lists">‹ Back</button>
```
Keep the `<input className="ld-name" ... />` and the rest of that header row (it's content, not nav).

- [ ] **Step 7: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/ResultsScreen.jsx web/src/MenuResultsScreen.jsx web/src/SupportScreen.jsx web/src/ProfileEditor.jsx web/src/UpgradeScreen.jsx web/src/ListsScreen.jsx
git commit -m "feat(ui): remove per-screen headers on deep screens (global header owns back)"
```

---

## Task 6: Scan-history preview treatment + mode badge

**Files:**
- Modify: `web/src/index.css` (add `--preview-bg`)
- Modify: `web/src/HomeScreen.jsx` (mode badge + barcode placeholder)
- Modify: `web/src/HomeScreen.css` (image ≤180px, contain, dark-gray; badge styles)

- [ ] **Step 1: Add the preview-backdrop token**

In `web/src/index.css`, inside `:root`, after `--on-chrome`, add:
```css
  --preview-bg: #2B2E2B;
```

- [ ] **Step 2: HomeScreen — add mode badge + barcode placeholder to scan cards**

In `web/src/HomeScreen.jsx`, import the badge helper (extend the existing homeModel import):
```jsx
import { profileAvatar, scanCardModel, scanModeBadge } from './homeModel';
```
Replace the scan-card image span so it (a) uses a barcode illustration for no-photo barcode scans, and (b) always shows a mode badge. Change the card's image block from:
```jsx
                    <span className="scan-card-img">
                      {m.imageUrl ? <img src={m.imageUrl} alt="" /> : <span className="scan-card-noimg">{s.mode === 'barcode' ? '▦' : s.mode === 'menu' ? '≣' : '⊟'}</span>}
                    </span>
```
to:
```jsx
                    <span className="scan-card-img">
                      {(() => {
                        const badge = scanModeBadge(s.mode);
                        return (
                          <>
                            {m.imageUrl
                              ? <img src={m.imageUrl} alt="" />
                              : <span className="scan-card-noimg">{badge.key === 'barcode' ? '||I|I||' : badge.key === 'menu' ? '≣' : '⊟'}</span>}
                            <span className={`scan-mode-badge scan-mode-${badge.key}`} aria-label={badge.label}>
                              {badge.key === 'barcode'
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" /></svg>
                                : badge.key === 'menu'
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v18M6 8h3M18 3c-2 0-3 2-3 5s1 4 3 4v9" /></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6 9.5 3h5L16 6" /><circle cx="12" cy="13" r="3" /></svg>}
                            </span>
                          </>
                        );
                      })()}
                    </span>
```

- [ ] **Step 3: HomeScreen.css — constrain preview + badge styles**

In `web/src/HomeScreen.css`, replace the `.scan-card-img` / `.scan-card-img img` / `.scan-card-noimg` rules:
```css
.scan-card-img { width: 100%; aspect-ratio: 16/10; background: var(--card); display: block; }
.scan-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.scan-card-noimg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: var(--muted); }
```
with:
```css
.scan-card-img { position: relative; width: 100%; height: 180px; max-height: 180px; background: var(--preview-bg); display: flex; align-items: center; justify-content: center; }
.scan-card-img img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.scan-card-noimg { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; letter-spacing: 2px; color: rgba(255,255,255,.7); font-family: monospace; }
.scan-mode-badge { position: absolute; top: 8px; left: 8px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(0,0,0,.55); }
.scan-mode-barcode { background: var(--sage-deep); }
.scan-mode-menu { background: var(--warning); }
.scan-mode-label { background: rgba(0,0,0,.55); }
```

- [ ] **Step 4: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/index.css web/src/HomeScreen.jsx web/src/HomeScreen.css
git commit -m "feat(ui): scan preview 180px/contain/dark-gray + per-scan mode badge"
```

---

## Task 7: Open Food Facts image fix

**Files:**
- Modify: `web/src/App.jsx` (`handleResult`)

- [ ] **Step 1: Persist and display the OFF image for non-menu scans**

In `web/src/App.jsx` `handleResult`, the non-menu `setDoc` saves `imageUrl,` (the uploaded camera photo, `null` for barcode). Change that saved field to fall back to the server-provided OFF URL:
```jsx
          imageUrl,
```
→
```jsx
          imageUrl: imageUrl || data.imageUrl || null,
```
And the navigate call:
```jsx
    navigate('/results', { state: { result: data, source: src, imageUrl } });
```
→
```jsx
    navigate('/results', { state: { result: data, source: src, imageUrl: imageUrl || data.imageUrl || null } });
```

- [ ] **Step 2: Verify build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/App.jsx
git commit -m "fix(scan): persist and show Open Food Facts product photo for barcode scans"
```

---

## Task 8: Full verification

- [ ] **Step 1: Unit tests + build**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/headerModel.test.js src/homeModel.test.js src/legal.test.js 2>&1 | grep -E "# tests|# pass|# fail"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: all tests pass; build succeeds.

- [ ] **Step 2: Manual flow (signed-in)**

- The deep-green header shows on **every** in-app screen: logo on the 4 tabs, a back arrow + title on sub-screens (Results, Menu results, history detail, list detail, profile editor, Support, Upgrade). Back goes to the mapped parent (Results → Home, editor → Profiles, etc.).
- The account avatar/popover is reachable from **every** in-app screen; "How are ingredients flagged" opens the sheet from anywhere.
- Bottom nav shows on every in-app screen; it and the header are **absent** on Login, Terms gate, `/terms`, `/privacy`, and `/scan` (camera stays immersive).
- No screen shows a second/duplicate header.
- Scan-history previews are ≤180px, letterboxed on dark gray (portrait → side bars); each card shows the correct mode badge (barcode / label / menu); a no-photo barcode scan shows the barcode placeholder.
- **A barcode scan now shows its Open Food Facts product photo** in Results, in history detail, and on the Home grid card.

- [ ] **Step 3: Accessibility (manual + axe)**

- Each screen has one header with a title; back is a labeled button; avatar keeps `aria-haspopup`/`aria-expanded`; popover focus mgmt intact.
- Mode badges expose an `aria-label` (scan type not conveyed by icon alone).
- Contrast: white-on-deep-green header, badges, and pills pass AA; header/nav don't overlap content (screens scroll within the frame).

- [ ] **Step 4: Deploy note**

Frontend-only, no Firestore rules change — a normal push to `main` deploys it (Firebase Hosting). Remaining known seam: each screen's **body** is still in its old visual style under the new frame; full body restyle is a later sub-project.

---

## Self-Review

**Spec coverage:**
- Persistent header + nav on all in-app screens; chrome-free exceptions (Login, gate, Terms/Privacy, Scan) — Tasks 2, 3 ✓
- Contextual header (logo/back/title) via `headerForRoute`; parent-map back — Tasks 1, 2 ✓
- Account avatar/popover global (moved from Home); About sheet relocated — Tasks 2, 4 ✓
- Per-screen headers removed (Home, History, Profiles, Lists, Results, MenuResults, Support, ProfileEditor, Upgrade, ListDetail) — Tasks 4, 5 ✓
- Screen roots fit the frame (fixed/100dvh → 100%) — Task 3 ✓
- Scan preview ≤180px, contain, dark-gray backdrop — Task 6 ✓
- Mode badge per scan (barcode/label/menu) + barcode placeholder — Tasks 1, 6 ✓
- OFF image persisted + displayed for barcode scans — Task 7 ✓
- WCAG AA (header/back labels, badge labels, contrast) — Tasks 2, 6, 8 ✓

**Placeholder scan:** No TBD/TODO; each edit shows exact before/after. The header-removal steps target specific existing markup verified in the codebase (`.hist-header`, `.pe-header`, `results-back`, `support-title`, ListDetail's `lists-back` vs its `ld-name` input).

**Type consistency:** `headerForRoute(pathname) -> {title,showLogo,backTo}` (Task 1) consumed exactly in `AppHeader` (Task 2). `scanModeBadge(mode) -> {key,label}` (Task 1) consumed in HomeScreen scan cards (Task 6). `AppShell` renders `AppHeader` + `Outlet` + `BottomNav` (Task 3); routes are children of the shell layout route. `AccountMenu({onClose,onAbout})` unchanged from SP1, now rendered by `AppHeader` (Task 2) instead of Home (Task 4). OFF-image fallback `imageUrl || data.imageUrl || null` is applied identically to the saved doc and the navigate state (Task 7).
