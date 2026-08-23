# UI Redesign 3D + History Per-Person Flags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix History to show live **per-person** flag counts (per profile) on each card, and restyle the final screens — Login, Legal pages, Terms gate — onto the design tokens/patterns.

**Architecture:** A pure `historyFlags.js` derives per-profile pill data; History computes it via `rematchBatch` (non-menu) + `menuSnapshot` (menu), seeding a fallback single pill instantly then upgrading to per-person. Batch D is class-swaps + tokenization.

**Tech Stack:** React (Vite ESM), the existing `/scan/rematch-batch` endpoint, CSS tokens, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-22-ui-redesign-3d-plus-history-flags-design.md`

## Global Constraints

- **Node 20** — prefix `node`/`npx` with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Tokens only** (allow `var(--white)`); reuse `.ui-*`.
- **Per-person pills are text-labeled** ("{name} {count}"); AA contrast.
- **No stored-data migration** — History recomputes on view.
- **Scope:** History flags + Login/Legal/Gate. No routing/other-screen changes.
- **Deploy:** frontend-only, no rules change.

---

## Task 1: Pure `historyFlags` helper

**Files:** Create `web/src/historyFlags.js`, `web/src/historyFlags.test.js`

**Interfaces:**
- `perProfileFromRematch(profilesArr) -> [{ name, count }]`
- `perProfileFromMenu(menuProfilesArr) -> [{ name, count }]`
- `statusPills(perProfile) -> [{ label, variant }]` (`variant` ∈ `'safe'|'danger'`)

- [ ] **Step 1: Write the failing test**

Create `web/src/historyFlags.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { perProfileFromRematch, perProfileFromMenu, statusPills } from './historyFlags.js';

test('perProfileFromRematch: name + flagged.length; null name → Unnamed', () => {
  assert.deepStrictEqual(
    perProfileFromRematch([{ name: 'Rosa', flagged: [1] }, { name: 'Anne', flagged: [1, 2] }, { name: null, flagged: [] }]),
    [{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 2 }, { name: 'Unnamed', count: 0 }]
  );
});

test('perProfileFromMenu: name + flaggedCount', () => {
  assert.deepStrictEqual(
    perProfileFromMenu([{ name: 'Rosa', flaggedCount: 1 }, { name: 'Anne', flaggedCount: 0 }]),
    [{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 0 }]
  );
});

test('statusPills: solo → single Safe/Flagged pill', () => {
  assert.deepStrictEqual(statusPills([{ name: 'X', count: 0 }]), [{ label: 'Safe', variant: 'safe' }]);
  assert.deepStrictEqual(statusPills([{ name: 'X', count: 3 }]), [{ label: 'Flagged (3)', variant: 'danger' }]);
  assert.deepStrictEqual(statusPills([]), [{ label: 'Safe', variant: 'safe' }]);
});

test('statusPills: multi → per-person pills', () => {
  assert.deepStrictEqual(
    statusPills([{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 2 }]),
    [{ label: 'Rosa 1', variant: 'danger' }, { label: 'Anne 2', variant: 'danger' }]
  );
  assert.deepStrictEqual(
    statusPills([{ name: 'Bob', count: 0 }, { name: 'Anne', count: 2 }]),
    [{ label: 'Bob 0', variant: 'safe' }, { label: 'Anne 2', variant: 'danger' }]
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/historyFlags.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `historyFlags.js`**

Create `web/src/historyFlags.js`:
```js
// Pure helpers for per-person flag display on History cards. No IO.

export function perProfileFromRematch(profilesArr = []) {
  return profilesArr.map((p) => ({
    name: p.name != null && p.name !== '' ? p.name : 'Unnamed',
    count: Array.isArray(p.flagged) ? p.flagged.length : 0,
  }));
}

export function perProfileFromMenu(menuProfilesArr = []) {
  return menuProfilesArr.map((p) => ({
    name: p.name != null && p.name !== '' ? p.name : 'Unnamed',
    count: p.flaggedCount || 0,
  }));
}

// Solo family → one Safe/Flagged pill. Multi → one "{name} {count}" pill per profile.
export function statusPills(perProfile = []) {
  if (perProfile.length <= 1) {
    const count = perProfile[0]?.count || 0;
    return [{ label: count > 0 ? `Flagged (${count})` : 'Safe', variant: count > 0 ? 'danger' : 'safe' }];
  }
  return perProfile.map((p) => ({ label: `${p.name} ${p.count}`, variant: p.count > 0 ? 'danger' : 'safe' }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/historyFlags.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/historyFlags.js web/src/historyFlags.test.js
git commit -m "feat(ui): pure historyFlags helper (per-profile pill data)"
```

---

## Task 2: History per-person flags integration

**Files:** Modify `web/src/HistoryScreen.jsx`, `web/src/HistoryScreen.css`

- [ ] **Step 1: Imports + state**

In `web/src/HistoryScreen.jsx`:
- Add imports:
```jsx
import { rematchBatch } from './api';
import { perProfileFromRematch, perProfileFromMenu, statusPills } from './historyFlags';
```
- Add state near the other `useState`s:
```jsx
  const [flagsByScan, setFlagsByScan] = useState({});
```

- [ ] **Step 2: Compute per-profile flags in the load effect**

In the `load()` effect, after `setScans(...)`, replace:
```js
        const snap = await getDocs(q);
        setScans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
```
with:
```js
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setScans(loaded);

        // Seed a fallback single-pill instantly (menu from snapshot; others from stored primary flags),
        // then upgrade non-menu scans to live per-person via one rematch-batch call.
        const fb = {};
        for (const s of loaded) {
          fb[s.id] = s.mode === 'menu'
            ? perProfileFromMenu(s.menuSnapshot?.profiles || [])
            : [{ name: null, count: (s.flagged || []).length }];
        }
        setFlagsByScan(fb);

        const items = loaded
          .filter(s => s.mode !== 'menu' && s.rawText)
          .map(s => ({ itemId: s.id, rawText: s.rawText }));
        if (items.length) {
          try {
            const { results } = await rematchBatch(items);
            setFlagsByScan(prev => {
              const next = { ...prev };
              for (const r of results) next[r.itemId] = perProfileFromRematch(r.profiles);
              return next;
            });
          } catch (e) {
            console.error('Per-profile rematch failed; showing primary counts', e);
          }
        }
```

- [ ] **Step 3: Replace `StatusPill` with per-person pills**

In `web/src/HistoryScreen.jsx`, replace the `StatusPill` component:
```jsx
function StatusPill({ scan }) {
  const { status, label } = scanCardModel(scan);
  return <span className={`ui-pill ui-pill-${status === 'safe' ? 'safe' : 'danger'}`}>{label}</span>;
}
```
with:
```jsx
function StatusPills({ scan, flagsByScan }) {
  const perProfile = flagsByScan[scan.id] || [{ name: null, count: (scan.flagged || []).length }];
  return (
    <span className="hist-status">
      {statusPills(perProfile).map((p, i) => (
        <span key={i} className={`ui-pill ui-pill-${p.variant}`}>{p.label}</span>
      ))}
    </span>
  );
}
```
And change the usage `{confirmDeleteId !== scan.id && <StatusPill scan={scan} />}` → `{confirmDeleteId !== scan.id && <StatusPills scan={scan} flagsByScan={flagsByScan} />}`.
(The `scanCardModel` import may now be unused in HistoryScreen — remove it if so.)

- [ ] **Step 4: HistoryScreen.css — stack the per-person pills**

Append to `web/src/HistoryScreen.css`:
```css
.hist-status { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
```

- [ ] **Step 5: Build**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/HistoryScreen.jsx web/src/HistoryScreen.css
git commit -m "fix(history): show live per-person flag counts per profile on each card"
```

---

## Task 3: Batch D — Login / Legal / Terms gate restyle

**Files:** Modify `web/src/LoginScreen.css`, `web/src/LegalPages.css`, `web/src/TermsGate.jsx`, `web/src/TermsGate.css`

- [ ] **Step 1: Tokenize LoginScreen.css**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/#1C1917/var(--ink)/g; s/color: #fff/color: var(--white)/g; s/border-top-color: #fff/border-top-color: var(--white)/g; s/var\(--muted, #[0-9a-fA-F]+\)/var(--muted)/g' LoginScreen.css
grep -nE "#[0-9a-fA-F]{3,6}" LoginScreen.css || echo "login tokenized"
```
(Keep the Google button's dark treatment — `var(--ink)` bg + `var(--white)` text; do not touch the multicolor Google `G` mark.)

- [ ] **Step 2: Tokenize LegalPages.css**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/var\(--bg, #f7f5f0\)/var(--bg)/g; s/var\(--border, #e2ddd3\)/var(--border)/g; s/var\(--muted, #[0-9a-fA-F]+\)/var(--muted)/g; s/background: #fff/background: var(--surface)/g; s/color: #222/color: var(--ink)/g; s/background: #fff4e5/background: var(--warning-light)/g; s/border: 1px solid #f0c27b/border: 1px solid var(--warning)/g; s/color: #7a4a00/color: var(--warning)/g' LegalPages.css
grep -nE "#[0-9a-fA-F]{3,6}" LegalPages.css || echo "legal tokenized"
```

- [ ] **Step 3: TermsGate JSX — card + accept button onto patterns**

In `web/src/TermsGate.jsx`:
- `<div className="terms-gate-card" ...>` → `className="ui-card terms-gate-card"`.
- `<button className="terms-gate-accept" ...>` → `className="ui-btn ui-btn-primary terms-gate-accept"`.

- [ ] **Step 4: Tokenize TermsGate.css + trim accept button**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/var\(--bg, #f7f5f0\)/var(--bg)/g; s/var\(--border, #e2ddd3\)/var(--border)/g; s/var\(--muted, #[0-9a-fA-F]+\)/var(--muted)/g; s/background: #fff/background: var(--surface)/g; s/color: #b23b3b/color: var(--danger)/g; s/color: #fff/color: var(--white)/g' TermsGate.css
grep -nE "#[0-9a-fA-F]{3,6}" TermsGate.css || echo "gate tokenized"
```
Then read the `.terms-gate-card` and `.terms-gate-accept` rules; drop `.terms-gate-card`'s duplicated background/border/border-radius/box-shadow (now from `.ui-card`), keeping width/max-width/padding; drop `.terms-gate-accept`'s duplicated background/color/border/radius (now from `.ui-btn-primary`), keeping width/margins.

- [ ] **Step 5: Build + no-hex**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web
grep -nE "#[0-9a-fA-F]{3,6}" src/LoginScreen.css src/LegalPages.css src/TermsGate.css && echo "HEX REMAINS" || echo "batch D tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `batch D tokenized`; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/LoginScreen.css web/src/LegalPages.css web/src/TermsGate.jsx web/src/TermsGate.css
git commit -m "feat(ui): restyle Login + Legal + Terms gate onto tokens/patterns (Batch D)"
```

---

## Task 4: Full verification

- [ ] **Step 1: Tests + build + hex sweep**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/historyFlags.test.js src/homeModel.test.js src/headerModel.test.js src/resultsModel.test.js src/legal.test.js 2>&1 | grep -E "# tests|# pass|# fail"
grep -nE "#[0-9a-fA-F]{3,6}" src/LoginScreen.css src/LegalPages.css src/TermsGate.css && echo "HEX REMAINS" || echo "tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: tests pass; `tokenized`; build succeeds.

- [ ] **Step 2: Manual (signed-in)**

- History: a **multi-profile** scan flagged for two people shows **per-person pills** with correct counts (e.g. "Rosa 1", "Anne 2") — no longer a single wrong "Flagged 1"; a **solo** family shows one Safe/Flagged pill; menu scans show per-person from the snapshot; the fallback pill shows instantly and upgrades once the batch returns.
- Login/Legal/Gate: render on the new tokens (no off-palette colors); the Terms gate still blocks entry, accepts, and Sign-out works; legal pages readable.

- [ ] **Step 3: Accessibility (manual + axe)**

- Per-person pills are text-labeled + AA; gate dialog/checkbox/buttons keep labels + focus; legal heading hierarchy intact.

- [ ] **Step 4: Deploy note**

Frontend-only, no rules change — normal push. This completes SP3 (all screens restyled). Parked: the OFF-photo bug.

---

## Self-Review

**Spec coverage:** per-person pills via live rematch (non-menu) + menuSnapshot (menu) with instant fallback (Tasks 1,2) ✓; solo vs multi (Task 1 `statusPills`) ✓; Login/Legal/Gate tokenized onto `.ui-*` (Task 3) ✓; hex-grep gate (Tasks 3,4) ✓; pure helper unit-tested (Task 1) ✓; WCAG (Task 4) ✓.

**Placeholder scan:** No TBD. CSS-trim steps name exactly what to keep vs drop; JSX edits target verified markup (`terms-gate-card`, `terms-gate-accept`, History `StatusPill`/load effect).

**Type consistency:** `perProfileFromRematch`/`perProfileFromMenu -> [{name,count}]` feed `statusPills([{name,count}]) -> [{label,variant}]` (Task 1), rendered as `ui-pill ui-pill-{variant}` in `StatusPills` (Task 2). `rematchBatch(items) -> { results: [{itemId, profiles}] }` matches the server shape and the `perProfileFromRematch(r.profiles)` call (Task 2). `flagsByScan` keyed by scan id is written in the load effect and read in `StatusPills` (Task 2).
