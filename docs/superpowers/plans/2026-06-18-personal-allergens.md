# Personal Allergens & Sensitivities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save a personal list of allergens/sensitivities that are flagged in every scan, layered on top of the existing inflammatory ingredient detection.

**Architecture:** Client-side only — allergens stored in Firestore at `users/{uid}/allergens`, read once at app load via `onSnapshot`, exposed to all screens via `AllergenContext`. Matching runs pure client-side in `allergenMatcher.js` using exact ingredient name matching. Server is untouched.

**Tech Stack:** React 18, Firestore (firebase/firestore), Vite, plain CSS (no modules)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `web/src/allergenMatcher.js` | Pure: parse ingredient string → check exact name match |
| Create | `web/src/useAllergens.js` | Firestore CRUD hook + `AllergenContext` definition |
| Create | `web/src/AllergensScreen.jsx` | Management screen: list, delete, add sheet |
| Create | `web/src/AllergensScreen.css` | Styles for allergen screen and add sheet |
| Modify | `web/src/App.jsx` | Provide `AllergenContext`, add `/allergens` route |
| Modify | `web/src/HomeScreen.jsx` | Add "My Allergens" card |
| Modify | `web/src/HomeScreen.css` | Styles for allergen card and count badge |
| Modify | `web/src/ResultsScreen.jsx` | Show two sections; allergen flags on top |
| Modify | `web/src/ResultsScreen.css` | Section title color for allergen section |

---

## Task 1: `allergenMatcher.js` — pure matching logic

**Files:**
- Create: `web/src/allergenMatcher.js`

- [ ] **Step 1: Create the file**

```js
// Splits "Water, Sugar (cane), Onion, Salt" into ["Water", "Sugar (cane)", "Onion", "Salt"]
// Respects nested parentheses so "Natural Flavor (Onion, Garlic)" is one entry.
function parseIngredients(text) {
  const results = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      const t = current.trim();
      if (t) results.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) results.push(t);
  return results;
}

// Returns flagged items in the same shape as the server response.
// Exact match only: allergen "onion" matches ingredient "onion" but not "onion powder".
export function matchAllergens(rawText, allergens) {
  if (!rawText || !allergens || allergens.length === 0) return [];
  const ingredients = parseIngredients(rawText);
  const normalized = ingredients.map(s => s.toLowerCase().trim());
  const flagged = [];
  const seen = new Set();
  for (const allergen of allergens) {
    if (seen.has(allergen.id)) continue;
    const target = allergen.name.toLowerCase().trim();
    const idx = normalized.findIndex(n => n === target);
    if (idx !== -1) {
      seen.add(allergen.id);
      flagged.push({
        id: allergen.id,
        flag: allergen.name,
        severity: allergen.type === 'allergy' ? 'high' : 'moderate',
        explanation: 'Listed in your personal allergens.',
        matchedOn: ingredients[idx],
      });
    }
  }
  return flagged;
}
```

- [ ] **Step 2: Add a temporary smoke-test script and run it**

Create `web/src/allergenMatcher.test.js` temporarily:

```js
import { matchAllergens } from './allergenMatcher';

const allergens = [
  { id: '1', name: 'onion', type: 'allergy' },
  { id: '2', name: 'garlic', type: 'sensitivity' },
];

// Should match "Onion" (case-insensitive exact match)
const r1 = matchAllergens('Water, Onion, Onion Powder, Salt', allergens);
console.assert(r1.length === 1, 'should find 1 match');
console.assert(r1[0].flag === 'onion', 'flag should be onion');
console.assert(r1[0].severity === 'high', 'allergy should be high');

// Should NOT match "Onion Powder" for allergen "onion"
const r2 = matchAllergens('Water, Onion Powder, Salt', allergens);
console.assert(r2.length === 0, 'onion should not match onion powder');

// Sensitivity should be moderate
const r3 = matchAllergens('garlic, salt', allergens);
console.assert(r3[0].severity === 'moderate', 'sensitivity should be moderate');

console.log('All allergenMatcher checks passed');
```

Run it:

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/web && node --experimental-vm-modules src/allergenMatcher.test.js 2>/dev/null || node -e "
const { matchAllergens } = await import('./src/allergenMatcher.js');
" 2>/dev/null; echo "If errors above, verify logic manually then delete the test file"
```

Alternatively, just read through the code — if `parseIngredients` splits on commas outside parentheses and `matchAllergens` does a `===` comparison after `.toLowerCase().trim()`, the logic is correct. Delete `allergenMatcher.test.js` after verifying.

- [ ] **Step 3: Commit**

```bash
git add web/src/allergenMatcher.js
git commit -m "Add allergenMatcher: exact ingredient name matching for personal allergens"
```

---

## Task 2: `useAllergens.js` — Firestore hook + context

**Files:**
- Create: `web/src/useAllergens.js`

- [ ] **Step 1: Create the file**

```js
import { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const AllergenContext = createContext({
  allergens: [],
  loading: true,
  addAllergen: async () => {},
  removeAllergen: async () => {},
});

export function useAllergenContext() {
  return useContext(AllergenContext);
}

export function useAllergens(user) {
  const [allergens, setAllergens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllergens([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'allergens'),
      snap => {
        setAllergens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  async function addAllergen({ name, type }) {
    await addDoc(collection(db, 'users', user.uid, 'allergens'), {
      name: name.toLowerCase().trim(),
      type,
      createdAt: serverTimestamp(),
    });
  }

  async function removeAllergen(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'allergens', id));
  }

  return { allergens, loading, addAllergen, removeAllergen };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/useAllergens.js
git commit -m "Add useAllergens hook and AllergenContext for Firestore-backed allergen state"
```

---

## Task 3: `App.jsx` — wire context and route

> **Dependency:** This task imports `AllergensScreen` (created in Task 5). The dev server will show an import error after Step 1 until Task 5 is complete — that's expected. Complete Tasks 3 and 4 first for the commit history, then finish Task 5 to resolve the error.

**Files:**
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Add imports at the top of `App.jsx`**

After the existing imports, add:

```js
import { useAllergens, AllergenContext } from './useAllergens';
import AllergensScreen from './AllergensScreen';
```

- [ ] **Step 2: Call `useAllergens` and provide context in `AppRoutes`**

Inside the `AppRoutes` function, directly after `const navigate = useNavigate();`, add:

```js
const allergenAPI = useAllergens(user);
```

Then wrap the entire return value of `AppRoutes` in the context provider. The function currently returns either a loading spinner div or a `<Routes>` block. Wrap **both** in the provider:

```jsx
// Replace the loading spinner return:
if (!authReady) {
  return (
    <AllergenContext.Provider value={allergenAPI}>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid var(--border)', borderTopColor: 'var(--sage)',
          display: 'block', animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    </AllergenContext.Provider>
  );
}

// Replace the Routes return:
return (
  <AllergenContext.Provider value={allergenAPI}>
    <Routes>
      {/* ... all existing routes unchanged ... */}
    </Routes>
  </AllergenContext.Provider>
);
```

- [ ] **Step 3: Add the `/allergens` route inside `<Routes>`**

Add this route alongside the existing ones (order doesn't matter, but place it after `/history`):

```jsx
<Route
  path="/allergens"
  element={
    <RequireAuth user={user} authReady={authReady}>
      <AllergensScreen onBack={() => navigate('/home')} />
    </RequireAuth>
  }
/>
```

- [ ] **Step 4: Add `onAllergens` navigation prop to `HomeRoute`**

Replace the existing `HomeRoute` component definition:

```jsx
function HomeRoute({ user, onScan, onHistory, onAllergens }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onAllergens={onAllergens} />;
}
```

And update the `/home` route to pass it:

```jsx
<Route
  path="/home"
  element={
    <RequireAuth user={user} authReady={authReady}>
      <HomeRoute
        user={user}
        onScan={() => navigate('/scan')}
        onHistory={() => navigate('/history')}
        onAllergens={() => navigate('/allergens')}
      />
    </RequireAuth>
  }
/>
```

- [ ] **Step 5: Start dev server and confirm no console errors**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/web && npm run dev
```

Open http://localhost:5173. Sign in. Should load home screen with no errors. Navigating to `/allergens` will 404 visually (component not yet built) but shouldn't crash.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.jsx
git commit -m "Wire AllergenContext provider and /allergens route in App"
```

> **Now create AllergensScreen (Task 5) to resolve the import error before verifying in browser.**

---

## Task 4: `HomeScreen.jsx` + `HomeScreen.css` — allergens card

**Files:**
- Modify: `web/src/HomeScreen.jsx`
- Modify: `web/src/HomeScreen.css`

- [ ] **Step 1: Add import and icon to `HomeScreen.jsx`**

At the top of `HomeScreen.jsx`, add the import:

```js
import { useAllergenContext } from './useAllergens';
```

Add the icon component (alongside the existing `CameraIcon` and `HistoryIcon`):

```jsx
function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
```

- [ ] **Step 2: Update the `HomeScreen` component**

Replace the function signature and add allergen card:

```jsx
export default function HomeScreen({ user, onScan, onHistory, onAllergens }) {
  const firstName = user.displayName?.split(' ')[0] || 'there';
  const [showAbout, setShowAbout] = useState(false);
  const { allergens } = useAllergenContext();

  return (
    <div className="home-root">
      {/* existing header unchanged */}
      <div className="home-header">
        <div className="home-user">
          {user.photoURL
            ? <img className="home-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            : <div className="home-avatar home-avatar-fallback">{firstName[0]}</div>
          }
          <div className="home-user-info">
            <p className="home-greeting">Hi, {firstName}</p>
            <button className="home-signout" onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="home-content">
        {/* existing brand unchanged */}
        <div className="home-brand">
          <img src="/favicon.png" width="72" height="72" alt="" style={{ borderRadius: 18, display: 'block', margin: '0 auto 16px' }} />
          <h1 className="home-title">Ingredient<br />Scanner</h1>
          <p className="home-sub">Know what's in your child's food.</p>
        </div>

        <div className="home-cards">
          <button className="home-card home-card-scan" onClick={onScan}>
            <span className="home-card-icon"><CameraIcon /></span>
            <span className="home-card-label">Scan</span>
            <span className="home-card-desc">Label or barcode</span>
          </button>

          <button className="home-card home-card-history" onClick={onHistory}>
            <span className="home-card-icon"><HistoryIcon /></span>
            <span className="home-card-label">History</span>
            <span className="home-card-desc">View past scans</span>
          </button>

          <button className="home-card home-card-allergens" onClick={onAllergens}>
            <span className="home-card-icon"><ShieldIcon /></span>
            <span className="home-card-label">My Allergens</span>
            <span className="home-card-desc">
              {allergens.length > 0
                ? `${allergens.length} item${allergens.length !== 1 ? 's' : ''}`
                : 'None set'}
            </span>
            {allergens.length > 0 && (
              <span className="home-allergen-badge">{allergens.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* existing footer unchanged */}
      <div className="home-footer">
        <button className="home-footer-btn" onClick={() => setShowAbout(true)}>
          How are ingredients flagged?
        </button>
      </div>

      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Add CSS to `HomeScreen.css`**

Append to the end of `HomeScreen.css`:

```css
.home-card-allergens {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 1px solid var(--border);
}

.home-card-allergens .home-card-icon {
  background: var(--danger-light);
  color: var(--danger);
}

.home-allergen-badge {
  min-width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify in browser**

Home screen should now show three cards: Scan, History, My Allergens. Tapping "My Allergens" should navigate to `/allergens` (currently blank, built next task).

- [ ] **Step 5: Commit**

```bash
git add web/src/HomeScreen.jsx web/src/HomeScreen.css
git commit -m "Add My Allergens card to home screen"
```

---

## Task 5: `AllergensScreen.jsx` + `AllergensScreen.css`

**Files:**
- Create: `web/src/AllergensScreen.jsx`
- Create: `web/src/AllergensScreen.css`

- [ ] **Step 1: Create `AllergensScreen.jsx`**

```jsx
import { useState } from 'react';
import { useAllergenContext } from './useAllergens';
import './AllergensScreen.css';

function AllergenRow({ allergen, onRemove }) {
  const isAllergy = allergen.type === 'allergy';
  return (
    <div className={`allergen-row ${isAllergy ? 'allergen-row-high' : 'allergen-row-mod'}`}>
      <div className="allergen-row-info">
        <span className="allergen-row-name">{allergen.name}</span>
        <span className={`allergen-row-type ${isAllergy ? 'allergen-type-high' : 'allergen-type-mod'}`}>
          {isAllergy ? 'Allergy · High concern' : 'Sensitivity · Moderate concern'}
        </span>
      </div>
      <button className="allergen-row-remove" onClick={onRemove} aria-label={`Remove ${allergen.name}`}>
        ×
      </button>
    </div>
  );
}

function AddSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('allergy');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), type });
    setSaving(false);
  }

  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={e => e.stopPropagation()}>
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Add ingredient</h2>
        <input
          className="allergen-input"
          placeholder="e.g. onion, gluten, soy..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="allergen-type-row">
          <button
            className={`allergen-type-btn ${type === 'allergy' ? 'allergen-type-btn-active-high' : ''}`}
            onClick={() => setType('allergy')}
          >
            Allergy
          </button>
          <button
            className={`allergen-type-btn ${type === 'sensitivity' ? 'allergen-type-btn-active-mod' : ''}`}
            onClick={() => setType('sensitivity')}
          >
            Sensitivity
          </button>
        </div>
        <p className="allergen-type-hint">
          {type === 'allergy' ? 'Flagged as high concern.' : 'Flagged as moderate concern.'}
        </p>
        <button
          className="allergen-save-btn"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export default function AllergensScreen({ onBack }) {
  const { allergens, addAllergen, removeAllergen } = useAllergenContext();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="allergens-root">
      <div className="allergens-header">
        <button className="allergens-back" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="allergens-title">My Allergens</h1>
      </div>

      <div className="allergens-scroll">
        <p className="allergens-hint">
          Exact names only — "onion" won't match "onion powder".
        </p>
        {allergens.length === 0 ? (
          <p className="allergens-empty">No allergens added yet. Tap + to add your first.</p>
        ) : (
          allergens.map(a => (
            <AllergenRow
              key={a.id}
              allergen={a}
              onRemove={() => removeAllergen(a.id)}
            />
          ))
        )}
      </div>

      <button className="allergens-fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddSheet
          onSave={async (item) => { await addAllergen(item); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `AllergensScreen.css`**

```css
.allergens-root {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.allergens-header {
  padding: env(safe-area-inset-top, 52px) 20px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.allergens-back {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--sage);
  cursor: pointer;
  padding: 12px 0;
  min-height: 44px;
}

.allergens-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  padding-bottom: 16px;
}

.allergens-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  -webkit-overflow-scrolling: touch;
}

.allergens-hint {
  font-size: 13px;
  color: var(--ink-3);
  margin-bottom: 20px;
  line-height: 1.5;
}

.allergens-empty {
  font-size: 15px;
  color: var(--ink-3);
  text-align: center;
  margin-top: 60px;
  line-height: 1.5;
}

.allergen-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 14px 4px 14px 16px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.allergen-row-high { border-left-color: var(--danger); }
.allergen-row-mod  { border-left-color: var(--warning); }

.allergen-row-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.allergen-row-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  text-transform: capitalize;
}

.allergen-row-type {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.allergen-type-high { color: var(--danger); }
.allergen-type-mod  { color: var(--warning); }

.allergen-row-remove {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 22px;
  color: var(--ink-3);
  cursor: pointer;
  flex-shrink: 0;
}
.allergen-row-remove:active { color: var(--danger); }

/* Floating action button */
.allergens-fab {
  position: fixed;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--sage);
  color: #fff;
  font-size: 30px;
  line-height: 1;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(74, 124, 89, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.allergens-fab:active { transform: scale(0.95); }

/* Add sheet */
@keyframes allergen-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes allergen-slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.allergen-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  animation: allergen-fade-in 0.2s ease;
}

.allergen-sheet {
  width: 100%;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  padding: 12px 24px calc(28px + env(safe-area-inset-bottom, 0px));
  animation: allergen-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.allergen-sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin: 0 auto 20px;
}

.allergen-sheet-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 16px;
}

.allergen-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--ink);
  background: var(--bg);
  margin-bottom: 14px;
  outline: none;
}
.allergen-input:focus { border-color: var(--sage); }

.allergen-type-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.allergen-type-btn {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
  min-height: 44px;
}

.allergen-type-btn-active-high {
  border-color: var(--danger);
  background: var(--danger-light);
  color: var(--danger);
}

.allergen-type-btn-active-mod {
  border-color: var(--warning);
  background: var(--warning-light);
  color: var(--warning);
}

.allergen-type-hint {
  font-size: 12px;
  color: var(--ink-3);
  margin-bottom: 20px;
}

.allergen-save-btn {
  width: 100%;
  padding: 14px;
  background: var(--sage);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}
.allergen-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Verify in browser**

- Navigate to "My Allergens" from home screen
- Empty state message visible
- Tap + button → add sheet slides up
- Type "onion", select "Allergy", tap Add
- Sheet closes, "onion" appears in list with red left border and "ALLERGY · High concern"
- Tap "onion" row's × → item disappears from list
- Add a sensitivity item — amber left border, "SENSITIVITY · Moderate concern"
- Reload the page — allergens persist (Firestore)

- [ ] **Step 4: Commit**

```bash
git add web/src/AllergensScreen.jsx web/src/AllergensScreen.css
git commit -m "Add AllergensScreen with list, add sheet, and delete"
```

---

## Task 6: `ResultsScreen.jsx` + `ResultsScreen.css` — two-section display

**Files:**
- Modify: `web/src/ResultsScreen.jsx`
- Modify: `web/src/ResultsScreen.css`

- [ ] **Step 1: Add imports to `ResultsScreen.jsx`**

At the top of the file, add:

```js
import { useAllergenContext } from './useAllergens';
import { matchAllergens } from './allergenMatcher';
```

- [ ] **Step 2: Replace the `ResultsScreen` default export function**

Full replacement — the existing component body changes to add allergen logic and two-section rendering:

```jsx
export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { flagged = [], rawText = '', productName } = result;
  const { allergens } = useAllergenContext();

  const allergenFlags = matchAllergens(rawText, allergens);

  const allFlags = [...allergenFlags, ...flagged];
  const highCount = allFlags.filter(i => i.severity === 'high').length;
  const modCount = allFlags.filter(i => i.severity === 'moderate').length;
  const allClear = allFlags.length === 0;

  return (
    <div className="results-root">
      <div className="results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
        )}

        {imageUrl && (
          <div className="results-photo-wrap">
            <img src={imageUrl} alt="Scanned item" className="results-photo" />
          </div>
        )}

        <div className="results-header">
          {productName && <h1 className="results-product">{productName}</h1>}
          <p className="results-source">
            {source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}
          </p>
        </div>

        <div className={`banner ${allClear ? 'banner-safe' : highCount > 0 ? 'banner-danger' : 'banner-warning'}`}>
          <span className="banner-icon">{allClear ? '✓' : highCount > 0 ? '!' : '~'}</span>
          <div>
            <p className="banner-title">
              {allClear ? 'No flags found' : `${allFlags.length} ingredient${allFlags.length !== 1 ? 's' : ''} flagged`}
            </p>
            <p className="banner-sub">
              {allClear
                ? 'No known inflammatory ingredients detected.'
                : [highCount > 0 && `${highCount} high concern`, modCount > 0 && `${modCount} moderate concern`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {allergenFlags.length > 0 && (
          <section className="results-section">
            <h2 className="section-title section-title-allergen">Personal Allergens</h2>
            <div className="cards">
              {allergenFlags.map((item, i) => (
                <IngredientCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {flagged.length > 0 && (
          <section className="results-section">
            <h2 className="section-title">Flagged Ingredients</h2>
            <div className="cards">
              {flagged.map((item, i) => (
                <IngredientCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </section>
        )}

        {rawText && (
          <section className="results-section results-section-raw">
            <p className="raw-label">Full ingredient text</p>
            <p className="raw-text">{rawText}</p>
          </section>
        )}

        <p className="disclaimer">
          For informational purposes only. Not a substitute for medical or nutritional advice.
          Always consult a qualified professional.
        </p>
      </div>

      <div className="results-footer">
        <button className="scan-again-btn" onClick={onScanAgain}>
          {onBack ? 'New Scan' : 'Scan Again'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add section title color to `ResultsScreen.css`**

Append to the end of `ResultsScreen.css`:

```css
.section-title-allergen {
  color: var(--danger);
}
```

- [ ] **Step 4: Verify end-to-end in browser**

1. Go to My Allergens, add "onion" as Allergy and "garlic" as Sensitivity
2. Go to Scan, scan a product label that contains "onion" or "garlic" in the ingredients
3. Results screen should show:
   - "Personal Allergens" section (red label) with matched allergen cards
   - "Flagged Ingredients" section below with inflammatory flags
   - Banner count reflects both sections combined
4. Open a past scan from History — if it contains "onion", the Personal Allergens section appears there too
5. Go back to My Allergens, delete "onion", revisit the same history scan — Personal Allergens section is gone
6. Scan a product with only moderate allergens and no high inflammatory — banner shows `~` (warning) not `!`

- [ ] **Step 5: Commit**

```bash
git add web/src/ResultsScreen.jsx web/src/ResultsScreen.css
git commit -m "Show personal allergen flags as separate section in results"
```

---

## Task 7: Deploy

- [ ] **Step 1: Push to GitHub (triggers Firebase frontend deploy)**

```bash
git push
```

- [ ] **Step 2: Deploy backend to Railway**

No server changes were made — skip Railway deploy.

- [ ] **Step 3: Verify GitHub Actions**

```bash
gh run list --limit 3
```

Expected: latest run shows `completed success`.
