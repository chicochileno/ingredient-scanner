# UI Redesign 3C — History, Support & Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle History/Support/Upgrade onto the shared `.ui-*` patterns; make History rows cards with mode badges + safe/flagged pills; swap the save-to-list bookmark icon for the Lists (bullet-list) icon; and add rename + delete of a scan from its detail page.

**Architecture:** New shared `scanActions.js` (rename/delete Firestore + storage) and `ScanModeBadge.jsx` (badge component). Move the mode-badge styles + add `.ui-btn-danger` to `patterns.css`. History adopts them; `ResultsScreen` gains optional history actions wired by `HistoryScanRoute`. Support/Upgrade tokenized onto patterns.

**Tech Stack:** React (Vite ESM), Firebase Firestore/Storage, CSS tokens, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-22-ui-redesign-3c-history-support-upgrade-design.md`

## Global Constraints

- **Node 20** — prefix commands with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Tokens only** (allow `var(--white)`); reuse Batch A/B `.ui-*` + `--preview-bg`.
- **History rename/delete/save-to-list must keep working**; the detail-page rename/delete only appear in history context (fresh `/results` scans don't show them).
- **WCAG AA:** labels on icon buttons, pill text, focus, contrast.
- **Scope:** the three screens + `ResultsScreen` history actions + the shared helper/component. No unrelated changes.
- **Deploy:** frontend-only, no rules change.

---

## Task 1: Foundation — `scanActions`, `ScanModeBadge`, shared styles

**Files:**
- Create: `web/src/scanActions.js`, `web/src/ScanModeBadge.jsx`
- Modify: `web/src/patterns.css`, `web/src/HomeScreen.css`

- [ ] **Step 1: Create `scanActions.js`**

Create `web/src/scanActions.js`:
```js
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

// Rename a saved scan (updates productName).
export async function renameScan(uid, scanId, name) {
  await updateDoc(doc(db, 'users', uid, 'scans', scanId), { productName: name.trim() });
}

// Delete a saved scan doc + best-effort its stored camera image.
export async function deleteScan(uid, scan) {
  await deleteDoc(doc(db, 'users', uid, 'scans', scan.id));
  if (scan.imageUrl) {
    await deleteObject(ref(storage, `scans/${uid}/${scan.id}.jpg`)).catch(() => {});
  }
}
```

- [ ] **Step 2: Create `ScanModeBadge.jsx`**

Create `web/src/ScanModeBadge.jsx`:
```jsx
import { scanModeBadge } from './homeModel';

export default function ScanModeBadge({ mode, className = '' }) {
  const badge = scanModeBadge(mode);
  const icon = badge.key === 'barcode'
    ? <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" />
    : badge.key === 'menu'
    ? <path d="M6 3v18M6 8h3M18 3c-2 0-3 2-3 5s1 4 3 4v9" />
    : <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6 9.5 3h5L16 6" /><circle cx="12" cy="13" r="3" /></>;
  return (
    <span className={`scan-mode-badge scan-mode-${badge.key} ${className}`} aria-label={badge.label}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
    </span>
  );
}
```

- [ ] **Step 3: Move mode-badge styles into `patterns.css` + add `.ui-btn-danger`**

Append to `web/src/patterns.css`:
```css
.ui-btn-danger { background: var(--surface); color: var(--danger); border-color: var(--danger); }

/* Scan mode badge (shared by Home grid + History rows) */
.scan-mode-badge { position: absolute; top: 8px; left: 8px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(0,0,0,.55); }
.scan-mode-barcode { background: var(--sage-deep); }
.scan-mode-menu { background: var(--warning); }
.scan-mode-label { background: rgba(0,0,0,.55); }
```
Then in `web/src/HomeScreen.css`, **remove** the now-duplicated rules `.scan-mode-badge`, `.scan-mode-barcode`, `.scan-mode-menu`, `.scan-mode-label` (they live in patterns.css now; Home still renders identically).

- [ ] **Step 4: Build**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/scanActions.js web/src/ScanModeBadge.jsx web/src/patterns.css web/src/HomeScreen.css
git commit -m "feat(ui): shared scanActions + ScanModeBadge + .ui-btn-danger; move badge styles to patterns"
```

---

## Task 2: Restyle HistoryScreen

**Files:**
- Modify: `web/src/HistoryScreen.jsx`, `web/src/HistoryScreen.css`

- [ ] **Step 1: Imports + shared helpers**

In `web/src/HistoryScreen.jsx`:
- Add imports:
```jsx
import { scanCardModel } from './homeModel';
import ScanModeBadge from './ScanModeBadge';
import { renameScan, deleteScan as deleteScanDoc } from './scanActions';
```
- Refactor `saveName` to use the helper (keep the local state update):
```js
      await updateDoc(doc(db, 'users', user.uid, 'scans', scanId), {
        productName: editingName.trim(),
      });
```
→
```js
      await renameScan(user.uid, scanId, editingName);
```
- Refactor `deleteScan` body's Firestore/storage calls to the helper:
```js
      await deleteDoc(doc(db, 'users', user.uid, 'scans', scan.id));
      if (scan.imageUrl) {
        const imgRef = ref(storage, `scans/${user.uid}/${scan.id}.jpg`);
        await deleteObject(imgRef).catch(() => {});
      }
```
→
```js
      await deleteScanDoc(user.uid, scan);
```
(Leave the surrounding `setScans`/`setConfirmDeleteId` state updates intact. The now-unused `deleteObject`/`ref`/`storage` imports can stay or be removed — removing avoids lint noise; keep `db`/`doc`/`updateDoc`/`deleteDoc` if still used elsewhere in the file.)

- [ ] **Step 2: Replace `FlagBadge` with a `.ui-pill` status via `scanCardModel`**

In `web/src/HistoryScreen.jsx`, replace the `FlagBadge` component:
```jsx
function FlagBadge({ flagged }) {
  if (!flagged || flagged.length === 0) {
    return <span className="hist-badge hist-badge-safe">Clear</span>;
  }
  const hasHigh = flagged.some(f => f.severity === 'high');
  return (
    <span className={`hist-badge ${hasHigh ? 'hist-badge-danger' : 'hist-badge-warn'}`}>
      {flagged.length} flag{flagged.length !== 1 ? 's' : ''}
    </span>
  );
}
```
with:
```jsx
function StatusPill({ scan }) {
  const { status, label } = scanCardModel(scan);
  return <span className={`ui-pill ui-pill-${status === 'safe' ? 'safe' : 'danger'}`}>{label}</span>;
}
```
And change the usage `{confirmDeleteId !== scan.id && <FlagBadge flagged={scan.flagged} />}` → `{confirmDeleteId !== scan.id && <StatusPill scan={scan} />}`.

- [ ] **Step 3: Row → `.ui-card`; thumbnail → contained + mode badge; save-to-list icon → bullet-list**

In `web/src/HistoryScreen.jsx`, in the non-editing item render:
- Change `<button className="hist-item" onClick={() => onSelect(scan)}>` → `<button className="ui-card hist-item" onClick={() => onSelect(scan)}>`.
- In the thumbnail block, add the mode badge and keep the image/placeholder. Replace:
```jsx
                      <div className="hist-item-thumb">
                        {scan.imageUrl
                          ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                          : <span className="hist-thumb-placeholder">
                              {scan.mode === 'barcode' ? '▦' : '⊟'}
                            </span>
                        }
                      </div>
```
with:
```jsx
                      <div className="hist-item-thumb">
                        {scan.imageUrl
                          ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                          : <span className="hist-thumb-placeholder">{scan.mode === 'barcode' ? '||I|I||' : scan.mode === 'menu' ? '≣' : '⊟'}</span>}
                        <ScanModeBadge mode={scan.mode} className="hist-mode-badge" />
                      </div>
```
- Swap the save-to-list bookmark icon for the bullet-list icon. Replace:
```jsx
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
```
with:
```jsx
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
```

- [ ] **Step 4: HistoryScreen.css — tokenize + thumbnail contained + badge sizing**

Tokenize:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/color: #fff/color: var(--white)/g; s/color:#fff/color:var(--white)/g' HistoryScreen.css
```
Then read the `.hist-item-thumb` / `.hist-thumb-img` / `.hist-thumb-placeholder` rules and replace them so the thumb is a contained dark-gray box with a corner badge (add these; adjust existing to match):
```css
.hist-item-thumb { position: relative; width: 52px; height: 52px; flex: none; border-radius: 10px; overflow: hidden; background: var(--preview-bg); display: flex; align-items: center; justify-content: center; }
.hist-thumb-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.hist-thumb-placeholder { color: rgba(255,255,255,.7); font-family: monospace; font-size: 0.8rem; letter-spacing: 1px; }
.hist-item-thumb .scan-mode-badge { top: 2px; left: 2px; width: 18px; height: 18px; }
.hist-item-thumb .scan-mode-badge svg { width: 11px; height: 11px; }
```
Also, since `.hist-item` is now `.ui-card`, simplify its own rule to layout-only (drop duplicated surface/border/padding if present) — leave its flex/gap/align, `cursor`, and animation; check the existing `.hist-item {` block and remove background/border/border-radius/box-shadow lines if they duplicate `.ui-card`. Keep `margin`/`gap`/`display`.

- [ ] **Step 5: Build + no-hex**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web
grep -nE "#[0-9a-fA-F]{3,6}" src/HistoryScreen.css && echo "HEX REMAINS" || echo "history css tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `history css tokenized`; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/HistoryScreen.jsx web/src/HistoryScreen.css
git commit -m "feat(ui): History rows as cards + mode badges + pill status; list icon for save-to-list"
```

---

## Task 3: Rename + delete from the scan detail page

**Files:**
- Modify: `web/src/ResultsScreen.jsx`, `web/src/ResultsScreen.css`, `web/src/App.jsx`

- [ ] **Step 1: Add history actions to `ResultsScreen`**

In `web/src/ResultsScreen.jsx`:
- Change the signature to accept `historyActions`:
```jsx
export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
```
→
```jsx
export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl, historyActions = null }) {
```
- Add local state (near the other `useState`s):
```jsx
  const [editingName, setEditingName] = useState(null); // null = not editing
  const [confirmDelete, setConfirmDelete] = useState(false);
```
- Replace the header product-name block:
```jsx
        <div className="results-header">
          {productName && <h1 className="results-product">{productName}</h1>}
          <p className="results-source">{source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}</p>
        </div>
```
with:
```jsx
        <div className="results-header">
          {historyActions && editingName !== null ? (
            <div className="results-name-edit">
              <input className="ui-input" value={editingName} autoFocus onChange={(e) => setEditingName(e.target.value)} aria-label="Scan name" />
              <button className="ui-btn ui-btn-primary" onClick={async () => { await historyActions.onRename(editingName); setEditingName(null); }}>Save</button>
              <button className="ui-btn ui-btn-secondary" onClick={() => setEditingName(null)}>Cancel</button>
            </div>
          ) : (
            <h1 className="results-product">
              {productName || 'Scan'}
              {historyActions && (
                <button className="results-edit-name" aria-label="Edit name" onClick={() => setEditingName(productName || '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                </button>
              )}
            </h1>
          )}
          <p className="results-source">{source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}</p>
        </div>
```
- Add a delete affordance at the end of the scrollable content — insert **before** the closing of `.results-scroll` (right after the disclaimer `<p className="disclaimer">…</p>`):
```jsx
        {historyActions && (
          <div className="results-delete-wrap">
            {confirmDelete ? (
              <div className="results-delete-confirm">
                <span>Delete this scan?</span>
                <button className="ui-btn ui-btn-danger" onClick={() => historyActions.onDelete()}>Delete</button>
                <button className="ui-btn ui-btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button className="ui-btn ui-btn-danger results-delete-btn" onClick={() => setConfirmDelete(true)}>Delete scan</button>
            )}
          </div>
        )}
```

- [ ] **Step 2: ResultsScreen.css — small styles for the edit/delete affordances**

Append to `web/src/ResultsScreen.css`:
```css
.results-product { display: inline-flex; align-items: center; gap: 8px; }
.results-edit-name { background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px; }
.results-edit-name:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; border-radius: 6px; }
.results-name-edit { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
.results-name-edit .ui-input { flex: 1; min-width: 160px; }
.results-delete-wrap { margin: 24px 0 90px; }
.results-delete-btn { width: 100%; }
.results-delete-confirm { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.results-delete-confirm span { flex: 1; }
```

- [ ] **Step 3: Wire `HistoryScanRoute` (and confirm `ResultsRoute` passes none)**

In `web/src/App.jsx`, add the import:
```jsx
import { renameScan, deleteScan } from './scanActions';
```
In `HistoryScanRoute`, the non-menu `return (<ResultsScreen ... />)` — add `historyActions`:
```jsx
    <ResultsScreen
      result={scan}
      source={scan.mode}
      imageUrl={scan.imageUrl}
      onBack={() => navigate('/history')}
      onScanAgain={() => navigate('/scan')}
      historyActions={{
        onRename: async (name) => { await renameScan(user.uid, scanId, name); setScan((s) => ({ ...s, productName: name.trim() })); },
        onDelete: async () => { await deleteScan(user.uid, scan); navigate('/history'); },
      }}
    />
```
(Leave `ResultsRoute` — the fresh-scan `/results` — unchanged; it passes no `historyActions`, so the edit/delete affordances don't appear there.)

- [ ] **Step 4: Build**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/ResultsScreen.jsx web/src/ResultsScreen.css web/src/App.jsx
git commit -m "feat(scan): rename + delete a scan from its detail page (history context)"
```

---

## Task 4: Restyle Support + Upgrade

**Files:**
- Modify: `web/src/SupportScreen.jsx`, `web/src/SupportScreen.css`, `web/src/UpgradeScreen.jsx`, `web/src/UpgradeScreen.css`

- [ ] **Step 1: Support JSX — inputs + button onto patterns**

In `web/src/SupportScreen.jsx`:
- `className="support-input"` → `className="ui-input"`.
- `className="support-textarea"` → `className="ui-input support-textarea"` (keep the class for the `resize` rule).
- Both `className="support-primary"` buttons → `className="ui-btn ui-btn-primary"`.

- [ ] **Step 2: Support CSS — tokenize**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/var\(--bg, #f7f5f0\)/var(--bg)/g; s/var\(--muted, #[0-9a-fA-F]+\)/var(--muted)/g; s/var\(--border, #[0-9a-fA-F]+\)/var(--border)/g; s/background: #fff/background: var(--surface)/g; s/color: #b23b3b/color: var(--danger)/g' SupportScreen.css
```
Then remove/trim any now-obsolete `.support-input`/`.support-textarea` full rules that duplicate `.ui-input` — keep only `.support-textarea { resize: vertical; }` and delete the shared border/padding/background lines (now from `.ui-input`). Keep `.support-primary` rule or drop it (button now `.ui-btn-primary`).

- [ ] **Step 3: Upgrade JSX — CTA onto patterns**

In `web/src/UpgradeScreen.jsx`, change every `className="upgrade-btn"` → `className="ui-btn ui-btn-primary upgrade-btn"` (there are 3: the main CTA and two "back to home" buttons).

- [ ] **Step 4: Upgrade CSS — tokenize + card features**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/color: #fff/color: var(--white)/g; s/border-top-color: #fff/border-top-color: var(--white)/g' UpgradeScreen.css
```
Then read `.upgrade-btn` and `.upgrade-features` blocks; drop the `.upgrade-btn` visual rule's duplicated background/color/border/radius (now from `.ui-btn-primary`), keeping only sizing/margins; give `.upgrade-features` the card look via tokens (`background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow);`) if it isn't already.

- [ ] **Step 5: Build + no-hex**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web
grep -nE "#[0-9a-fA-F]{3,6}" src/SupportScreen.css src/UpgradeScreen.css && echo "HEX REMAINS" || echo "support/upgrade tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `support/upgrade tokenized`; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/SupportScreen.jsx web/src/SupportScreen.css web/src/UpgradeScreen.jsx web/src/UpgradeScreen.css
git commit -m "feat(ui): restyle Support + Upgrade onto shared patterns + tokens"
```

---

## Task 5: Full verification

- [ ] **Step 1: Tests + build + hex across all three CSS**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/homeModel.test.js src/headerModel.test.js src/resultsModel.test.js src/legal.test.js 2>&1 | grep -E "# tests|# pass|# fail"
grep -nE "#[0-9a-fA-F]{3,6}" src/HistoryScreen.css src/SupportScreen.css src/UpgradeScreen.css && echo "HEX REMAINS" || echo "tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: tests pass; `tokenized`; build succeeds.

- [ ] **Step 2: Manual (signed-in)**

- History: rows are cards with contained thumbnails + mode badges + safe/flagged `.ui-pill`; the save-to-list icon is the **bullet-list** (matches the Lists tab); inline rename, delete-confirm, and save-to-list all still work; menu scans show a menu badge + correct flagged status.
- Scan **detail page** (tap a history row): the pencil edits the name inline → Save persists (name updates in History); "Delete scan" (with confirm) removes it and returns to History. A **fresh** scan's `/results` shows **no** edit/delete affordances.
- Support: inputs + submit styled, form still submits.
- Upgrade: CTA + feature list styled; upgrade/portal flow unaffected.

- [ ] **Step 3: Accessibility (manual + axe)**

- Icon buttons labeled (Save to list / Edit name / Delete scan); pills text-labeled; mode badge `aria-label`; inputs labeled; focus visible; contrast AA.

- [ ] **Step 4: Deploy note**

Frontend-only, no rules change — normal push. Remaining: Batch D (Login/Legal/gate); OFF-photo bug still deferred.

---

## Self-Review

**Spec coverage:** History rows→ui-card + mode badge + pill status (Task 2) ✓; save-to-list icon→bullet-list (Task 2) ✓; rename+delete on detail page, history-context only (Tasks 1,3) ✓; shared `scanActions` + `ScanModeBadge` + moved badge styles + `.ui-btn-danger` (Task 1) ✓; Support/Upgrade tokenized onto patterns (Task 4) ✓; hex-grep gate (Tasks 2,4,5) ✓; WCAG (Task 5) ✓.

**Placeholder scan:** No TBD. Steps that trim CSS name the exact rules and what to keep vs drop; every JSX edit is against verified current markup.

**Type consistency:** `renameScan(uid, scanId, name)` / `deleteScan(uid, scan)` (Task 1) called identically in HistoryScreen (Task 2) and HistoryScanRoute (Task 3). `ScanModeBadge({mode,className})` (Task 1) used in History (Task 2). `historyActions={{onRename, onDelete}}` shape (Task 3) matches ResultsScreen's usage (Task 3 Step 1). `scanCardModel(scan).status/label` (Task 2) matches the Batch A helper. `.ui-btn-danger`/`.scan-mode-badge` defined in patterns.css (Task 1) are the classes used in Tasks 2–3.
