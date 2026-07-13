# Saved Collections (System 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save scanned + manual items into named family-level Lists, with live per-profile safe/flagged status, check-off, and a safe/flags filter.

**Architecture:** A new `POST /scan/rematch-batch` matches many item texts against all profiles in one call (profile data fetched once). Client `useLists` hook manages `users/{uid}/lists` + item subcollections. New Lists/ListDetail screens + a Save-to-list sheet reachable from Results and History. Home is restructured to a large Scan card + a 3-across row (History/Profiles/Lists).

**Tech Stack:** Node/Express + `node:test` (server), Firebase Admin/Web SDK, React + Vite.

**Spec:** `docs/superpowers/specs/2026-07-13-saved-collections-design.md`

**Testing note:** Server batch logic is unit-tested via a pure helper (`matchTextsForProfiles`) with `node --test` (run under Node ≥18: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`). The web client has no automated harness — client tasks end with `npm run build` + explicit manual verification.

---

## File Structure

**Server**
- Modify `server/utils/userMatchData.js` — add pure `matchTextsForProfiles` + async `rematchBatch`.
- Modify `server/routes/scan.js` — add `POST /scan/rematch-batch`.
- Modify `server/utils/userMatchData.test.js` (create) — unit-test `matchTextsForProfiles`.

**Client**
- Create `web/src/useLists.js` — `useLists` hook + `ListContext`.
- Modify `web/src/api.js` — `rematchBatch`.
- Create `web/src/SaveToListSheet.jsx` — pick/create list, save a product.
- Create `web/src/ListsScreen.jsx` + `web/src/ListsScreen.css` — lists index + list detail.
- Modify `web/src/ResultsScreen.jsx` — "Save to list" button.
- Modify `web/src/HistoryScreen.jsx` — "Save to list" action.
- Modify `web/src/HomeScreen.jsx` + `web/src/HomeScreen.css` — new layout + Lists card.
- Modify `web/src/App.jsx` — ListContext provider, `/lists` + `/lists/:listId` routes, `onLists`.
- Modify `firestore.rules` — owner-scoped `lists` subtree.

---

## Phase A — Server: batch rematch

### Task 1: `matchTextsForProfiles` pure helper + `rematchBatch`

**Files:** Modify `server/utils/userMatchData.js`; Create `server/utils/userMatchData.test.js`.

- [ ] **Step 1: Write the failing test**

Create `server/utils/userMatchData.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { matchTextsForProfiles } = require('./userMatchData');

// profilesData: [{ id, name, activeCategories, personalAllergens, dismissedIds }]
const profilesData = [
  { id: 'p1', name: 'Emma', activeCategories: ['dairy'], personalAllergens: [], dismissedIds: new Set() },
  { id: 'p2', name: 'Liam', activeCategories: ['dyes', 'dairy'], personalAllergens: [], dismissedIds: new Set() },
];

test('matches each item against every profile, keyed by itemId', () => {
  const items = [
    { itemId: 'a', rawText: 'Sugar, Red 40, Salt' },
    { itemId: 'b', rawText: 'Water, Milk' },
  ];
  const results = matchTextsForProfiles(profilesData, items);
  assert.strictEqual(results.length, 2);

  const a = results.find((r) => r.itemId === 'a');
  const aEmma = a.profiles.find((p) => p.profileId === 'p1');
  const aLiam = a.profiles.find((p) => p.profileId === 'p2');
  // Red 40 is a dye: not active for Emma (dairy only), active for Liam
  assert.strictEqual(aEmma.flagged.length, 0);
  assert.ok(aLiam.flagged.find((f) => f.id === 'red40'));

  const b = results.find((r) => r.itemId === 'b');
  // Milk is dairy: active for both
  assert.ok(b.profiles.find((p) => p.profileId === 'p1').flagged.find((f) => f.id === 'casein'));
  assert.ok(b.profiles.find((p) => p.profileId === 'p2').flagged.find((f) => f.id === 'casein'));
});

test('each result profile carries counts and name', () => {
  const results = matchTextsForProfiles(profilesData, [{ itemId: 'a', rawText: 'Red 40' }]);
  const liam = results[0].profiles.find((p) => p.profileId === 'p2');
  assert.strictEqual(liam.name, 'Liam');
  assert.strictEqual(liam.counts.high, 1); // Red 40 is high severity
});

test('blank rawText yields empty flags for all profiles', () => {
  const results = matchTextsForProfiles(profilesData, [{ itemId: 'x', rawText: '' }]);
  assert.strictEqual(results[0].profiles.every((p) => p.flagged.length === 0), true);
});

test('empty items array returns empty results', () => {
  assert.deepStrictEqual(matchTextsForProfiles(profilesData, []), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: FAIL — `matchTextsForProfiles` is not exported.

- [ ] **Step 3: Implement**

In `server/utils/userMatchData.js`, add these two functions after `matchAllProfiles` (and before `addDismissedFlag`). `matchTextsForProfiles` is pure (no Firestore); `rematchBatch` fetches profile data once:
```js
// Pure: match many item texts against pre-fetched profile data.
// profilesData: [{ id, name, activeCategories, personalAllergens, dismissedIds }]
// items: [{ itemId, rawText }]  ->  [{ itemId, profiles: [{ profileId, name, flagged, counts }] }]
function matchTextsForProfiles(profilesData, items) {
  return items.map((item) => ({
    itemId: item.itemId,
    profiles: profilesData.map((p) => {
      const flagged = matchIngredients(item.rawText || '', {
        activeCategories: p.activeCategories || [],
        personalAllergens: p.personalAllergens || [],
        dismissedIds: p.dismissedIds || new Set(),
      });
      return { profileId: p.id, name: p.name != null ? p.name : null, flagged, counts: countByTier(flagged) };
    }),
  }));
}

// Fetch profile data once, then match all item texts.
async function rematchBatch(uid, items) {
  const profiles = await getProfiles(uid);
  const profilesData = await Promise.all(
    profiles.map(async (p) => {
      const inputs = await getProfileFlagInputs(uid, p.id);
      return { id: p.id, name: p.name != null ? p.name : null, activeCategories: p.activeCategories || [], ...inputs };
    })
  );
  return matchTextsForProfiles(profilesData, items);
}
```
Then update the exports line:
```js
module.exports = { getProfiles, matchAllProfiles, addDismissedFlag, matchTextsForProfiles, rematchBatch };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS (existing suite still green).

- [ ] **Step 5: Commit**
```bash
git add server/utils/userMatchData.js server/utils/userMatchData.test.js
git commit -m "feat(server): matchTextsForProfiles + rematchBatch helper"
```

---

### Task 2: `POST /scan/rematch-batch` endpoint

**Files:** Modify `server/routes/scan.js`.

- [ ] **Step 1: Update the import**

In `server/routes/scan.js`, change:
```js
const { matchAllProfiles, addDismissedFlag } = require('../utils/userMatchData');
```
to:
```js
const { matchAllProfiles, addDismissedFlag, rematchBatch } = require('../utils/userMatchData');
```

- [ ] **Step 2: Add the endpoint**

In `server/routes/scan.js`, immediately before `module.exports = router;`, add:
```js
// Batch re-match: match many saved-item texts against all profiles in one call.
// Does NOT consume a scan.
router.post('/rematch-batch', requireAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' });
  }
  if (items.length > 200) {
    return res.status(400).json({ error: 'too many items' });
  }
  const clean = [];
  for (const it of items) {
    if (!it || typeof it.itemId !== 'string' || typeof it.rawText !== 'string') {
      return res.status(400).json({ error: 'each item needs itemId and rawText strings' });
    }
    clean.push({ itemId: it.itemId, rawText: it.rawText.slice(0, 20000) });
  }
  try {
    const results = await rematchBatch(req.uid, clean);
    res.json({ results });
  } catch (err) {
    console.error('Rematch-batch error:', err.message);
    res.status(500).json({ error: 'Failed to rematch batch' });
  }
});
```

- [ ] **Step 3: Verify it parses + suite**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Then: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: `ok`; all tests PASS.

- [ ] **Step 4: Commit**
```bash
git add server/routes/scan.js
git commit -m "feat(server): POST /scan/rematch-batch for list status"
```

---

## Phase B — Client data layer

### Task 3: `useLists` hook + `ListContext`

**Files:** Create `web/src/useLists.js`.

- [ ] **Step 1: Create the hook**

Create `web/src/useLists.js`:
```js
import { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const ListContext = createContext({ lists: [], loading: true });
export function useListContext() { return useContext(ListContext); }

export function useLists(user) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLists([]); setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'lists'), orderBy('order')),
      (snap) => { setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error('Failed to load lists:', err); setLoading(false); }
    );
    return unsub;
  }, [user?.uid]);

  async function addList(name) {
    const ref = await addDoc(collection(db, 'users', user.uid, 'lists'), {
      name: name?.trim() || 'Untitled list',
      order: lists.length,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  async function renameList(listId, name) {
    await updateDoc(doc(db, 'users', user.uid, 'lists', listId), { name: name?.trim() || 'Untitled list' });
  }
  async function deleteList(listId) {
    await deleteDoc(doc(db, 'users', user.uid, 'lists', listId));
  }
  async function addScannedItem(listId, { name, rawText, imageUrl, upc }) {
    await addDoc(collection(db, 'users', user.uid, 'lists', listId, 'items'), {
      kind: 'scanned',
      name: name || 'Scanned product',
      rawText: rawText || '',
      imageUrl: imageUrl || null,
      upc: upc || null,
      checked: false,
      addedAt: serverTimestamp(),
    });
  }
  async function addManualItem(listId, name) {
    await addDoc(collection(db, 'users', user.uid, 'lists', listId, 'items'), {
      kind: 'manual',
      name: name.trim(),
      checked: false,
      addedAt: serverTimestamp(),
    });
  }
  async function removeItem(listId, itemId) {
    await deleteDoc(doc(db, 'users', user.uid, 'lists', listId, 'items', itemId));
  }
  async function toggleChecked(listId, itemId, checked) {
    await updateDoc(doc(db, 'users', user.uid, 'lists', listId, 'items', itemId), { checked });
  }

  return { lists, loading, addList, renameList, deleteList, addScannedItem, addManualItem, removeItem, toggleChecked };
}
```

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build succeeds (hook unused until wired — fine).

- [ ] **Step 3: Commit**
```bash
git add web/src/useLists.js
git commit -m "feat(web): useLists hook + ListContext"
```

---

### Task 4: `rematchBatch` API client

**Files:** Modify `web/src/api.js`.

- [ ] **Step 1: Add the call**

At the end of `web/src/api.js`, add:
```js
export async function rematchBatch(items) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/rematch-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ items }),
  }));
}
```

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds.

- [ ] **Step 3: Commit**
```bash
git add web/src/api.js
git commit -m "feat(web): rematchBatch API call"
```

---

### Task 5: Wire ListContext + routes into App.jsx

**Files:** Modify `web/src/App.jsx`.

- [ ] **Step 1: Imports**

In `web/src/App.jsx`, add near the other imports:
```js
import { useLists, ListContext } from './useLists';
import ListsScreen, { ListDetailScreen } from './ListsScreen';
```

- [ ] **Step 2: Instantiate + provide the context**

In `AppRoutes`, after `const profileAPI = useProfiles(user);` add:
```js
  const listAPI = useLists(user);
```
Wrap the existing provider tree with `ListContext.Provider`. In BOTH the loading branch and the routes branch, change the outermost `<ProfileContext.Provider value={profileAPI}>` … `</ProfileContext.Provider>` to be wrapped by `<ListContext.Provider value={listAPI}>` … `</ListContext.Provider>`. Example for the routes branch:
```jsx
    <ListContext.Provider value={listAPI}>
    <ProfileContext.Provider value={profileAPI}>
      <BillingContext.Provider value={billing}>
        {/* existing <Routes>…</Routes> */}
      </BillingContext.Provider>
    </ProfileContext.Provider>
    </ListContext.Provider>
```
Do the same wrapping for the loading-branch provider tree.

- [ ] **Step 3: Home callback + routes**

- In `HomeRoute`, add `onLists` to the destructure and pass-through:
```jsx
function HomeRoute({ user, onScan, onHistory, onProfiles, onLists, onUpgrade }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onProfiles={onProfiles} onLists={onLists} onUpgrade={onUpgrade} />;
}
```
- In the `/home` route element, add `onLists={() => navigate('/lists')}` alongside the other on* props.
- Add two routes after the `/profiles` route block:
```jsx
        <Route
          path="/lists"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ListsScreen onBack={() => navigate('/home')} onOpen={(id) => navigate(`/lists/${id}`)} />
            </RequireAuth>
          }
        />
        <Route
          path="/lists/:listId"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ListDetailScreen user={user} onBack={() => navigate('/lists')} />
            </RequireAuth>
          }
        />
```

- [ ] **Step 4: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: FAILS until `ListsScreen` exists (Task 9/10). If executing strictly in order, expect this build to fail on the missing import; it passes after Task 10. (Or do Tasks 9–10 before building here.)

- [ ] **Step 5: Commit**
```bash
git add web/src/App.jsx
git commit -m "feat(web): ListContext provider + /lists routes"
```

---

## Phase C — Client UI

### Task 6: Home layout — large Scan + 3-across row

**Files:** Modify `web/src/HomeScreen.jsx`, `web/src/HomeScreen.css`.

- [ ] **Step 1: Add a Lists icon + restructure the cards**

In `web/src/HomeScreen.jsx`, add a `ListsIcon` component near the other icon components:
```jsx
function ListsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
```
Update the signature to accept `onLists`:
```jsx
export default function HomeScreen({ user, onScan, onHistory, onProfiles, onLists, onUpgrade }) {
```
Add `const { lists } = useListContext();` next to the existing `const { profiles } = useProfileContext();`, and add the import at top:
```js
import { useListContext } from './useLists';
```
Replace the entire `<div className="home-cards"> … </div>` block with:
```jsx
        <div className="home-cards">
          <button className="home-card home-card-scan home-card-primary" onClick={atLimit ? onUpgrade : onScan}>
            <span className="home-card-icon"><CameraIcon /></span>
            <span className="home-card-label">Scan</span>
            <span className="home-card-desc">Label or barcode</span>
          </button>

          <div className="home-card-row">
            <button className="home-card home-card-mini" onClick={onHistory}>
              <span className="home-card-icon"><HistoryIcon /></span>
              <span className="home-card-label">History</span>
            </button>

            <button className="home-card home-card-mini" onClick={onProfiles}>
              <span className="home-card-icon"><ShieldIcon /></span>
              <span className="home-card-label">Profiles</span>
              {profiles.length > 1 && <span className="home-mini-badge">{profiles.length}</span>}
            </button>

            <button className="home-card home-card-mini" onClick={onLists}>
              <span className="home-card-icon"><ListsIcon /></span>
              <span className="home-card-label">Lists</span>
              {lists.length > 0 && <span className="home-mini-badge">{lists.length}</span>}
            </button>
          </div>
        </div>
```

- [ ] **Step 2: CSS — larger Scan, 3-across mini row**

Append to `web/src/HomeScreen.css`:
```css
/* System 3 home layout: large Scan card + 3-across mini row */
.home-card-primary {
  padding: 28px 20px;
}
.home-card-primary .home-card-icon {
  transform: scale(1.25);
  margin-bottom: 6px;
}
.home-card-primary .home-card-label {
  font-size: 22px;
}
.home-card-row {
  display: flex;
  gap: 10px;
}
.home-card-mini {
  flex: 1 1 0;
  position: relative;
  padding: 16px 8px;
  align-items: center;
  text-align: center;
}
.home-card-mini .home-card-label {
  font-size: 14px;
}
.home-mini-badge {
  position: absolute;
  top: 6px; right: 8px;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--sage, #3a7);
  color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.home-card-mini:focus-visible, .home-card-primary:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
```
(The base `.home-card` styles still apply — these classes only adjust size/layout.)

- [ ] **Step 3: Verify build + eyeball**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds. (Visual check happens in the final manual pass.)

- [ ] **Step 4: Commit**
```bash
git add web/src/HomeScreen.jsx web/src/HomeScreen.css
git commit -m "feat(web): home layout with large Scan card + Lists card"
```

---

### Task 7: Save-to-list sheet

**Files:** Create `web/src/SaveToListSheet.jsx`.

- [ ] **Step 1: Create the component**

Create `web/src/SaveToListSheet.jsx` (reuses `.allergen-sheet*` styles from `AllergensScreen.css`, which the caller imports):
```jsx
import { useState } from 'react';
import { useListContext } from './useLists';

// product: { name, rawText, imageUrl, upc }
export default function SaveToListSheet({ product, onClose }) {
  const { lists, addList, addScannedItem } = useListContext();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState(null);

  async function saveTo(listId, listName) {
    if (busy) return;
    setBusy(true);
    try {
      await addScannedItem(listId, product);
      setSavedTo(listName);
      setTimeout(onClose, 900);
    } catch (e) {
      console.error('Save to list failed:', e);
      setBusy(false);
    }
  }
  async function createAndSave() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addList(newName.trim());
      await addScannedItem(id, product);
      setSavedTo(newName.trim());
      setTimeout(onClose, 900);
    } catch (e) {
      console.error('Create+save failed:', e);
      setBusy(false);
    }
  }

  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Save to list">
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Save to list</h2>
        {savedTo ? (
          <p className="stl-saved">Saved to “{savedTo}” ✓</p>
        ) : (
          <>
            {lists.length > 0 && (
              <div className="stl-lists">
                {lists.map((l) => (
                  <button key={l.id} className="stl-list-btn" disabled={busy} onClick={() => saveTo(l.id, l.name)}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="stl-new" className="pe-label">New list</label>
            <input id="stl-new" className="allergen-input" placeholder="e.g. School snacks"
              value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} />
            <button className="allergen-save-btn" onClick={createAndSave} disabled={!newName.trim() || busy}>
              {busy ? 'Saving…' : 'Create & save'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds (component unused until Task 8).

- [ ] **Step 3: Commit**
```bash
git add web/src/SaveToListSheet.jsx
git commit -m "feat(web): SaveToListSheet component"
```

---

### Task 8: "Save to list" from Results and History

**Files:** Modify `web/src/ResultsScreen.jsx`, `web/src/HistoryScreen.jsx`, `web/src/ListsScreen.css` (shared styles).

- [ ] **Step 1: Results screen button**

In `web/src/ResultsScreen.jsx`:
- Add imports at top:
```js
import SaveToListSheet from './SaveToListSheet';
import './AllergensScreen.css';
```
- Add state inside `ResultsScreen` (near the other hooks, after the `profiles`/`selectedId` setup):
```js
  const [showSave, setShowSave] = useState(false);
```
- In the `results-footer`, add a Save button before the Scan-again button:
```jsx
      <div className="results-footer">
        <button className="save-list-btn" onClick={() => setShowSave(true)}>Save to list</button>
        <button className="scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
      </div>
```
- Just before the final closing `</div>` of the component's returned tree, add:
```jsx
      {showSave && (
        <SaveToListSheet
          product={{ name: productName || 'Scanned product', rawText, imageUrl: imageUrl || null, upc: result.upc || null }}
          onClose={() => setShowSave(false)}
        />
      )}
```

- [ ] **Step 2: History screen action**

In `web/src/HistoryScreen.jsx`:
- Add imports:
```js
import SaveToListSheet from './SaveToListSheet';
import './AllergensScreen.css';
```
- Add state in the component:
```js
  const [saveScan, setSaveScan] = useState(null);
```
- In `hist-row-actions` (the non-delete-confirm branch), add a save button before the edit button:
```jsx
                        <button className="hist-edit-btn" onClick={() => setSaveScan(scan)} aria-label="Save to list">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </button>
```
- Before the final `</div>` closing `hist-root`, add:
```jsx
      {saveScan && (
        <SaveToListSheet
          product={{ name: saveScan.productName || defaultName(saveScan), rawText: saveScan.rawText || '', imageUrl: saveScan.imageUrl || null, upc: saveScan.upc || null }}
          onClose={() => setSaveScan(null)}
        />
      )}
```

- [ ] **Step 3: Add shared button CSS**

Create `web/src/ListsScreen.css` with (start the file; more classes added in Task 9/10):
```css
.save-list-btn {
  flex: 1;
  padding: 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  background: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.save-list-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.results-footer { display: flex; gap: 10px; }
.stl-lists { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.stl-list-btn { text-align: left; padding: 12px 14px; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; background: #fff; cursor: pointer; }
.stl-list-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.stl-saved { text-align: center; color: #15803d; font-weight: 600; padding: 16px 0; }
```
Import it in `web/src/ResultsScreen.jsx` (add near the other CSS import):
```js
import './ListsScreen.css';
```

- [ ] **Step 4: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds.

- [ ] **Step 5: Commit**
```bash
git add web/src/ResultsScreen.jsx web/src/HistoryScreen.jsx web/src/ListsScreen.css
git commit -m "feat(web): Save to list from Results and History"
```

---

### Task 9: Lists index screen

**Files:** Create `web/src/ListsScreen.jsx` (index component; detail added in Task 10).

- [ ] **Step 1: Create the index screen**

Create `web/src/ListsScreen.jsx`:
```jsx
import { useState } from 'react';
import './ListsScreen.css';
import { useListContext } from './useLists';

export default function ListsScreen({ onBack, onOpen }) {
  const { lists, addList } = useListContext();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function create() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      const id = await addList(newName.trim());
      setNewName('');
      onOpen(id);
    } catch (e) {
      console.error('Create list failed:', e);
      setAdding(false);
    }
  }

  return (
    <div className="lists-root">
      <div className="lists-header">
        <button className="lists-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="lists-title">Lists</h1>
      </div>
      <div className="lists-scroll">
        {lists.length === 0 && <p className="lists-empty">No lists yet. Create one below, or tap “Save to list” after a scan.</p>}
        {lists.map((l) => (
          <button key={l.id} className="list-row" onClick={() => onOpen(l.id)}>
            <span className="list-row-name">{l.name}</span>
          </button>
        ))}
        <div className="lists-new">
          <label htmlFor="lists-new-name" className="pe-label">New list</label>
          <input id="lists-new-name" className="allergen-input" placeholder="e.g. Road trip snacks"
            value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="lists-new-btn" onClick={create} disabled={!newName.trim() || adding}>
            {adding ? 'Creating…' : '+ New list'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append list-index CSS**

Append to `web/src/ListsScreen.css`:
```css
.lists-root { display: flex; flex-direction: column; height: 100dvh; background: var(--bg); }
.lists-header { display: flex; align-items: center; gap: 12px; padding: 16px; }
.lists-back { background: none; border: none; font-size: 16px; color: var(--sage, #3a7); cursor: pointer; }
.lists-back:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.lists-title { font-size: 22px; margin: 0; }
.lists-scroll { flex: 1; overflow-y: auto; padding: 0 16px 24px; }
.lists-empty { color: #6b7280; font-size: 14px; }
.list-row { display: flex; width: 100%; text-align: left; background: #fff; border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px; padding: 16px; margin-bottom: 10px; cursor: pointer; }
.list-row:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.list-row-name { font-size: 16px; font-weight: 600; }
.lists-new { margin-top: 16px; }
.lists-new-btn { width: 100%; margin-top: 8px; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 10px; background: none; cursor: pointer; }
.lists-new-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
```
(Also import the profile catalog's `.pe-label` — it lives in `ProfilesScreen.css`; add `import './ProfilesScreen.css';` at the top of `ListsScreen.jsx` so `.pe-label` and `.allergen-input` reuse works. Also add `import './AllergensScreen.css';` for `.allergen-input`.)

- [ ] **Step 3: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds (App.jsx from Task 5 also imports `ListDetailScreen`; add a temporary stub export if needed, but Task 10 adds it — if building before Task 10, expect the `ListDetailScreen` import in App.jsx to fail. Do Task 10 before this build for green.)

- [ ] **Step 4: Commit**
```bash
git add web/src/ListsScreen.jsx web/src/ListsScreen.css
git commit -m "feat(web): Lists index screen"
```

---

### Task 10: List detail screen (items, status, filter, check-off, manual add)

**Files:** Modify `web/src/ListsScreen.jsx` (add `ListDetailScreen` export), `web/src/ListsScreen.css`.

- [ ] **Step 1: Add `ListDetailScreen`**

In `web/src/ListsScreen.jsx`, add these imports at the top (merge with existing):
```js
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { rematchBatch } from './api';
```
Then add this exported component at the end of the file:
```jsx
function statusText(profiles) {
  // profiles: [{ profileId, name, flagged, counts }]
  if (!profiles || profiles.length === 0) return { label: 'Checking…', flagged: false };
  const flaggedProfiles = profiles.filter((p) => (p.flagged || []).length > 0);
  if (flaggedProfiles.length === 0) {
    return { label: profiles.length > 1 ? 'Safe for all' : 'Safe', flagged: false };
  }
  if (profiles.length === 1) return { label: 'Flagged', flagged: true };
  const names = flaggedProfiles.map((p) => p.name || 'Unnamed').join(', ');
  return { label: `Flagged for ${names}`, flagged: true };
}

export function ListDetailScreen({ user, onBack }) {
  const { listId } = useParams();
  const { lists, renameList, deleteList, addManualItem, removeItem, toggleChecked } = useListContext();
  const list = lists.find((l) => l.id === listId);
  const [items, setItems] = useState([]);
  const [statusById, setStatusById] = useState({}); // itemId -> profiles[]
  const [filter, setFilter] = useState('all'); // all | safe | flags
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'users', user.uid, 'lists', listId, 'items'), orderBy('addedAt')),
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user?.uid, listId]);

  useEffect(() => {
    const scanned = items.filter((it) => it.kind === 'scanned');
    if (scanned.length === 0) { setStatusById({}); return; }
    let cancelled = false;
    rematchBatch(scanned.map((it) => ({ itemId: it.id, rawText: it.rawText || '' })))
      .then(({ results }) => {
        if (cancelled) return;
        const map = {};
        for (const r of results) map[r.itemId] = r.profiles;
        setStatusById(map);
      })
      .catch((e) => console.error('List rematch failed:', e));
    return () => { cancelled = true; };
  }, [items]);

  if (!list) return null;

  const scanned = items.filter((it) => it.kind === 'scanned');
  const manual = items.filter((it) => it.kind === 'manual');
  const visibleScanned = scanned.filter((it) => {
    if (filter === 'all') return true;
    const st = statusText(statusById[it.id]);
    return filter === 'safe' ? !st.flagged : st.flagged;
  });

  return (
    <div className="lists-root">
      <div className="lists-header">
        <button className="lists-back" onClick={onBack} aria-label="Back to lists">‹ Back</button>
        <input className="ld-name" defaultValue={list.name} maxLength={50}
          onBlur={(e) => renameList(listId, e.target.value)} aria-label="List name" />
      </div>
      <div className="lists-scroll">
        <div className="ld-filter" role="group" aria-label="Filter items">
          {['all', 'safe', 'flags'].map((f) => (
            <button key={f} className={`ld-filter-btn ${filter === f ? 'ld-filter-on' : ''}`}
              aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'safe' ? 'Safe' : 'Has flags'}
            </button>
          ))}
        </div>

        {visibleScanned.map((it) => {
          const st = statusText(statusById[it.id]);
          return (
            <div key={it.id} className="ld-item">
              <input type="checkbox" checked={!!it.checked} aria-label={`Mark ${it.name} bought`}
                onChange={(e) => toggleChecked(listId, it.id, e.target.checked)} />
              {it.imageUrl ? <img className="ld-thumb" src={it.imageUrl} alt="" /> : <span className="ld-thumb ld-thumb-ph">▦</span>}
              <div className="ld-item-body">
                <span className={`ld-item-name ${it.checked ? 'ld-checked' : ''}`}>{it.name}</span>
                <span className={`ld-status ${st.flagged ? 'ld-status-flag' : 'ld-status-safe'}`}>{st.label}</span>
              </div>
              <button className="ld-remove" onClick={() => removeItem(listId, it.id)} aria-label={`Remove ${it.name}`}>×</button>
            </div>
          );
        })}

        {manual.length > 0 && <p className="ld-section">Not scanned</p>}
        {manual.map((it) => (
          <div key={it.id} className="ld-item">
            <input type="checkbox" checked={!!it.checked} aria-label={`Mark ${it.name} bought`}
              onChange={(e) => toggleChecked(listId, it.id, e.target.checked)} />
            <div className="ld-item-body">
              <span className={`ld-item-name ${it.checked ? 'ld-checked' : ''}`}>{it.name}</span>
              <span className="ld-status ld-status-neutral">Not scanned</span>
            </div>
            <button className="ld-remove" onClick={() => removeItem(listId, it.id)} aria-label={`Remove ${it.name}`}>×</button>
          </div>
        ))}

        <div className="ld-add">
          <label htmlFor="ld-manual" className="pe-label">Add an item</label>
          <input id="ld-manual" className="allergen-input" placeholder="e.g. bananas"
            value={manualName} maxLength={60}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manualName.trim()) { addManualItem(listId, manualName); setManualName(''); } }} />
          <button className="lists-new-btn" disabled={!manualName.trim()}
            onClick={() => { addManualItem(listId, manualName); setManualName(''); }}>+ Add item</button>
        </div>

        <button className="ld-delete" onClick={() => { deleteList(listId); onBack(); }}>Delete this list</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append detail CSS**

Append to `web/src/ListsScreen.css`:
```css
.ld-name { flex: 1; font-size: 18px; font-weight: 600; border: none; background: none; padding: 4px 0; }
.ld-name:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.ld-filter { display: flex; gap: 8px; margin-bottom: 12px; }
.ld-filter-btn { padding: 6px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 999px; background: #fff; font-size: 13px; cursor: pointer; }
.ld-filter-on { border-color: #2563eb; color: #1d4ed8; font-weight: 700; }
.ld-filter-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.ld-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.ld-item input[type="checkbox"] { width: 20px; height: 20px; }
.ld-thumb { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
.ld-thumb-ph { display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #9ca3af; }
.ld-item-body { flex: 1; display: flex; flex-direction: column; }
.ld-item-name { font-size: 15px; }
.ld-checked { text-decoration: line-through; color: #9ca3af; }
.ld-status { font-size: 12px; }
.ld-status-safe { color: #15803d; }
.ld-status-flag { color: #b91c1c; }
.ld-status-neutral { color: #6b7280; }
.ld-remove { background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer; }
.ld-remove:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.ld-section { margin: 18px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
.ld-add { margin-top: 18px; }
.ld-delete { margin-top: 28px; width: 100%; padding: 12px; border: 1px solid #fecaca; color: #b91c1c; background: #fff; border-radius: 10px; cursor: pointer; }
.ld-delete:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
```

- [ ] **Step 3: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: succeeds (App.jsx's `ListDetailScreen` import now resolves).

- [ ] **Step 4: Commit**
```bash
git add web/src/ListsScreen.jsx web/src/ListsScreen.css
git commit -m "feat(web): list detail — items, live status, filter, check-off, manual add"
```

---

### Task 11: Firestore rules + full verification

**Files:** Modify `firestore.rules`.

- [ ] **Step 1: Add the lists rule**

In `firestore.rules`, add before the `billing` block:
```
    match /users/{userId}/lists/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
```

- [ ] **Step 2: Verify server + build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'` → all PASS.
Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'` → succeeds.

- [ ] **Step 3: Manual verification (needs live Firebase + Node 20 dev servers)**

1. Home shows a large **Scan** card with **History / Profiles / Lists** in a row beneath.
2. Scan a product → **Save to list** → create "School snacks" → item saved.
3. Open **Lists → School snacks**: the item shows a live per-profile status ("Safe for all" / "Flagged for Liam"); on a 2-profile account with one profile Dairy-Free, a dairy product flags for only the relevant profile.
4. Check off an item (strike-through); add a manual item ("bananas") → appears under "Not scanned".
5. Filter **Safe / Has flags** filters the scanned items; manual items stay grouped.
6. Save the same product from **History** too.
7. Accessibility: keyboard-operate checkboxes/filter/rows; verify status is text (not color-only); run axe on the Lists screens.

- [ ] **Step 4: Deploy note**

⚠️ At deploy time, **manually publish `firestore.rules`** in the Firebase Console (CI does not deploy rules) — otherwise all client list operations fail with permission-denied.

- [ ] **Step 5: Commit**
```bash
git add firestore.rules
git commit -m "fix(rules): owner access to lists subtree"
```

---

## Self-Review — Spec Coverage

- Family-level lists + scanned/manual items → Tasks 3, 10. ✅
- Live per-profile status via batch rematch → Tasks 1, 2, 4, 10. ✅
- Self-contained snapshots (no scan reference) → Task 3 (`addScannedItem` copies fields). ✅
- Save from Results + History → Task 8. ✅
- Manual add, check-off, All/Safe/Has-flags filter → Task 10. ✅
- `/scan/rematch-batch` (fetch profile data once) → Tasks 1, 2. ✅
- Home layout: large Scan + 3-across (History/Profiles/Lists) → Task 6. ✅
- Lists screen + list detail + save sheet → Tasks 7, 9, 10. ✅
- Firestore rules for lists → Task 11. ✅
- Accessibility (checkbox semantics, text status, aria-pressed filter, focus, labeled sheets) → Tasks 6–10. ✅
- Out of scope (sharing, substitutes, drag-reorder, manual→scanned upgrade, UPC dedup) → not implemented, correct. ✅

Consistent names across tasks: `matchTextsForProfiles`/`rematchBatch` (server), `rematchBatch(items)` (client api → `{ results:[{itemId, profiles}] }`), `useLists`/`ListContext`/`useListContext` with `addList/renameList/deleteList/addScannedItem/addManualItem/removeItem/toggleChecked`, item `kind: 'scanned'|'manual'`, `ListsScreen` + `ListDetailScreen`, `SaveToListSheet` `product={ name, rawText, imageUrl, upc }`.

No placeholders remain.
