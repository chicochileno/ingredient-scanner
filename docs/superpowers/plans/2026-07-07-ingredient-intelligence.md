# Ingredient Intelligence (System 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's two divergent ingredient matchers with one precise, variant-aware server-side engine that adds a soft "Worth Checking" tier, per-user dismiss, and citation-backed explanations.

**Architecture:** All matching moves server-side (`server/utils/ingredientMatcher.js`). The engine reads the curated inflammatory DB plus the user's personal allergens (`users/{uid}/allergens`) and dismissed flags (`users/{uid}/dismissedFlags`), returning tiered, filtered flags. The client `web/src/allergenMatcher.js` is deleted; `ResultsScreen` renders three sections from the server response. A no-charge `POST /scan/rematch` keeps history views live against current allergens/dismissals.

**Tech Stack:** Node.js + Express (server), Node's built-in `node:test` runner (zero new deps), Firebase Admin SDK (Firestore), React + Vite (web client).

**Spec:** `docs/superpowers/specs/2026-07-06-ingredient-intelligence-design.md`

**Testing note:** The server matching engine is a pure function and is developed strictly test-first with `node:test`. The Firestore I/O wrappers and the React client have no existing automated harness in this repo; adding one (e.g. Vitest) is out of scope for System 1, so those tasks specify explicit **manual verification** steps instead. The risky logic (matching) is fully unit-tested.

---

## File Structure

**Server:**
- Modify `server/package.json` — add `"test": "node --test"` script.
- Rewrite `server/utils/ingredientMatcher.js` — the unified engine.
- Create `server/utils/ingredientMatcher.test.js` — unit tests (`node:test`).
- Modify `server/data/inflammatoryIngredients.js` — add `negators`, `ambiguousNames`, `citations`.
- Create `server/utils/userMatchData.js` — Firestore read/write helpers.
- Modify `server/routes/scan.js` — wire user data into matching; add `/dismiss` and `/rematch`.

**Client:**
- Modify `web/src/api.js` — add `dismissFlag` and `rematch`.
- Rewrite `web/src/ResultsScreen.jsx` + modify `web/src/ResultsScreen.css` — three sections, dismiss, sources.
- Modify `web/src/App.jsx` — `HistoryScanRoute` calls `rematch`.
- Delete `web/src/allergenMatcher.js`.

---

## Phase A — Server matching engine (pure, TDD)

### Task 1: New engine — whole-word / phrase matching

**Files:**
- Modify: `server/package.json`
- Test: `server/utils/ingredientMatcher.test.js` (create)
- Modify: `server/utils/ingredientMatcher.js`

- [ ] **Step 1: Add the test script**

In `server/package.json`, add to `"scripts"`:

```json
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "node --test"
  },
```

- [ ] **Step 2: Write the failing test**

Create `server/utils/ingredientMatcher.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { matchIngredients } = require('./ingredientMatcher');

test('matches a curated synonym variant at word boundaries', () => {
  const flags = matchIngredients('Sugar, FD&C Red No. 40, Salt');
  const red = flags.find((f) => f.id === 'red40');
  assert.ok(red, 'expected red40 to be flagged');
  assert.strictEqual(red.tier, 'confident');
  assert.strictEqual(red.source, 'curated');
  assert.strictEqual(red.severity, 'high');
});

test('does NOT match a synonym that only appears mid-word', () => {
  // "malt" is a gluten synonym; "maltodextrin" must not trigger it
  const flags = matchIngredients('Maltodextrin, Salt');
  assert.strictEqual(flags.find((f) => f.id === 'gluten'), undefined);
});

test('matches a whole word even with extra words around it', () => {
  // "wheat" gluten synonym inside "wheat flour"
  const flags = matchIngredients('Wheat Flour, Water');
  assert.ok(flags.find((f) => f.id === 'gluten'));
});

test('returns empty array for empty input', () => {
  assert.deepStrictEqual(matchIngredients(''), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — the current `matchIngredients` uses substring `includes`, so "Maltodextrin" wrongly matches `gluten`, and it has no `tier`/`source` fields.

- [ ] **Step 4: Rewrite the engine**

Replace the entire contents of `server/utils/ingredientMatcher.js`:

```js
const ingredients = require('../data/inflammatoryIngredients');

// Normalize: lowercase, strip punctuation (keep & and digits), collapse whitespace
function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip "may contain", allergen warnings, and X-free descriptor phrases
function stripNonIngredients(text) {
  return text
    .replace(/may contain[^.]*\.?/gi, '')
    .replace(/contains?:?\s*(traces?\s+of\s*)?[^.]*\.?/gi, '')
    .replace(/allergen\s+information[^.]*\.?/gi, '')
    .replace(/manufactured\s+in[^.]*\.?/gi, '')
    .replace(/processed\s+in[^.]*\.?/gi, '')
    .replace(/made\s+in\s+a\s+facility[^.]*\.?/gi, '')
    .replace(/produced\s+in[^.]*\.?/gi, '')
    .replace(/\b(gluten|dairy|casein|wheat|soy|nut|egg|peanut)[\s-]free\b/gi, '');
}

function parseIngredientList(rawText) {
  const cleaned = stripNonIngredients(rawText);
  return cleaned
    .split(/[,;()\[\]{}]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 1);
}

// True if `name` appears as a whole word/phrase inside the already-normalized `token`
function tokenContainsPhrase(token, name) {
  if (!name) return false;
  const re = new RegExp(`(^|\\s)${escapeRegex(name)}(\\s|$)`);
  return re.test(token);
}

// Evaluate one entry ({ names, negators?, ambiguousNames? }) against tokens.
// Returns { matchedOn, tier } or null.
function evaluateEntry(entry, tokens) {
  const names = entry.names || [];
  const negators = (entry.negators || []).map(normalize).filter(Boolean);
  const ambiguous = new Set((entry.ambiguousNames || []).map(normalize));
  for (const rawName of names) {
    const name = normalize(rawName);
    if (!name) continue;
    for (const token of tokens) {
      if (!tokenContainsPhrase(token, name)) continue;
      const suppressed = negators.some((neg) => tokenContainsPhrase(token, neg));
      if (suppressed) continue;
      const tier = ambiguous.has(name) ? 'possible' : 'confident';
      return { matchedOn: token, tier };
    }
  }
  return null;
}

function matchIngredients(rawText, options = {}) {
  const personalAllergens = options.personalAllergens || [];
  const dismissedIds =
    options.dismissedIds instanceof Set
      ? options.dismissedIds
      : new Set(options.dismissedIds || []);

  const tokens = parseIngredientList(rawText || '');
  const flagged = [];
  const seen = new Set();

  // Curated inflammatory ingredients
  for (const entry of ingredients) {
    if (seen.has(entry.id)) continue;
    const res = evaluateEntry(entry, tokens);
    if (!res) continue;
    seen.add(entry.id);
    flagged.push({
      id: entry.id,
      flag: entry.flag,
      category: entry.category,
      severity: entry.severity,
      tier: res.tier,
      source: 'curated',
      explanation: entry.explanation,
      matchedOn: res.matchedOn,
      ...(entry.citations ? { citations: entry.citations } : {}),
    });
  }

  // Personal allergens (each name is a one-item synonym list; no negators/ambiguous)
  for (const allergen of personalAllergens) {
    if (!allergen || !allergen.name || seen.has(allergen.id)) continue;
    const res = evaluateEntry({ names: [allergen.name] }, tokens);
    if (!res) continue;
    seen.add(allergen.id);
    const name = String(allergen.name);
    flagged.push({
      id: allergen.id,
      flag: name.charAt(0).toUpperCase() + name.slice(1),
      category: null,
      severity: allergen.type === 'allergy' ? 'high' : 'moderate',
      tier: 'confident',
      source: 'personal',
      explanation: 'Listed in your personal allergens.',
      matchedOn: res.matchedOn,
    });
  }

  // Override filter, then sort: confident-high, confident-moderate, possible last
  const rank = (f) => (f.tier === 'possible' ? 2 : f.severity === 'high' ? 0 : 1);
  return flagged.filter((f) => !dismissedIds.has(f.id)).sort((a, b) => rank(a) - rank(b));
}

module.exports = { matchIngredients, parseIngredientList };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS (4/4 in this file).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/utils/ingredientMatcher.js server/utils/ingredientMatcher.test.js
git commit -m "feat(server): whole-word ingredient matching engine with tiers"
```

---

### Task 2: Negator suppression (precision)

**Files:**
- Test: `server/utils/ingredientMatcher.test.js`
- Data: `server/data/inflammatoryIngredients.js`

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:

```js
test('negator suppresses a false-positive dairy match', () => {
  const flags = matchIngredients('Water, Coconut Milk, Sugar');
  assert.strictEqual(flags.find((f) => f.id === 'casein'), undefined);
});

test('negator does not suppress a real dairy match', () => {
  const flags = matchIngredients('Water, Goat Milk, Sugar');
  assert.ok(flags.find((f) => f.id === 'casein'), 'goat milk should still flag dairy');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `casein` currently has no `negators`, so "coconut milk" flags dairy.

- [ ] **Step 3: Add negators to the casein entry**

In `server/data/inflammatoryIngredients.js`, in the `casein` entry (id `'casein'`), add a `negators` field after `names`:

```js
    negators: ['coconut', 'oat', 'almond', 'soy', 'rice', 'cashew', 'hemp', 'pea', 'flax'],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — coconut milk suppressed, goat milk still flags.

- [ ] **Step 5: Commit**

```bash
git add server/data/inflammatoryIngredients.js server/utils/ingredientMatcher.test.js
git commit -m "feat(server): negator suppression for non-dairy 'milk' variants"
```

---

### Task 3: Ambiguous synonyms → "possible" tier

**Files:**
- Test: `server/utils/ingredientMatcher.test.js`
- Data: `server/data/inflammatoryIngredients.js`

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:

```js
test('ambiguous synonym resolves to the soft "possible" tier', () => {
  const flags = matchIngredients('Sugar, Soy Lecithin, Salt');
  const soy = flags.find((f) => f.id === 'soy');
  assert.ok(soy, 'expected soy to be flagged');
  assert.strictEqual(soy.tier, 'possible');
});

test('non-ambiguous synonym for the same entry stays confident', () => {
  const flags = matchIngredients('Soybean Oil, Salt');
  const soy = flags.find((f) => f.id === 'soy');
  assert.ok(soy);
  assert.strictEqual(soy.tier, 'confident');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `soy lecithin` currently matches as `confident` (no `ambiguousNames`).

- [ ] **Step 3: Add ambiguousNames to the soy entry**

In `server/data/inflammatoryIngredients.js`, in the `soy` entry (id `'soy'`), add after `names`:

```js
    ambiguousNames: ['soy lecithin'],
```

Ensure `'soy lecithin'` is present in that entry's `names` array (it already is).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/data/inflammatoryIngredients.js server/utils/ingredientMatcher.test.js
git commit -m "feat(server): soft 'possible' tier for ambiguous synonyms"
```

---

### Task 4: Personal allergens through the engine

**Files:**
- Test: `server/utils/ingredientMatcher.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:

```js
test('personal allergen matches variants at word boundaries', () => {
  const personalAllergens = [{ id: 'a1', name: 'onion', type: 'allergy' }];
  const flags = matchIngredients('Water, Onion Powder, Salt', { personalAllergens });
  const onion = flags.find((f) => f.id === 'a1');
  assert.ok(onion, 'expected personal allergen to match "onion powder"');
  assert.strictEqual(onion.source, 'personal');
  assert.strictEqual(onion.severity, 'high'); // type 'allergy' -> high
  assert.strictEqual(onion.tier, 'confident');
});

test('sensitivity-type personal allergen maps to moderate', () => {
  const personalAllergens = [{ id: 'a2', name: 'garlic', type: 'sensitivity' }];
  const flags = matchIngredients('Roasted Garlic, Salt', { personalAllergens });
  const garlic = flags.find((f) => f.id === 'a2');
  assert.ok(garlic);
  assert.strictEqual(garlic.severity, 'moderate');
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `cd server && npm test`
Expected: PASS — this behavior is already implemented in Task 1's engine. (This task locks the behavior with tests. If it unexpectedly fails, fix the personal-allergen loop in `ingredientMatcher.js` to match the spec before committing.)

- [ ] **Step 3: Commit**

```bash
git add server/utils/ingredientMatcher.test.js
git commit -m "test(server): lock personal-allergen matching + severity mapping"
```

---

### Task 5: Dismiss/override filtering + ordering

**Files:**
- Test: `server/utils/ingredientMatcher.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:

```js
test('dismissed ids are filtered out', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { dismissedIds: new Set(['red40']) });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('dismissedIds also accepts a plain array', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { dismissedIds: ['red40'] });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('possible-tier flags sort after confident flags', () => {
  const flags = matchIngredients('Red 40, Soy Lecithin'); // red40 confident/high, soy possible
  const redIdx = flags.findIndex((f) => f.id === 'red40');
  const soyIdx = flags.findIndex((f) => f.id === 'soy');
  assert.ok(redIdx < soyIdx, 'confident flag should come before possible flag');
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `cd server && npm test`
Expected: PASS — implemented in Task 1. Locks override + ordering behavior. Fix the filter/sort in `ingredientMatcher.js` if any case fails.

- [ ] **Step 3: Commit**

```bash
git add server/utils/ingredientMatcher.test.js
git commit -m "test(server): lock dismiss filtering and tier ordering"
```

---

### Task 6: Enrich curated data with citations

**Files:**
- Data: `server/data/inflammatoryIngredients.js`
- Test: `server/utils/ingredientMatcher.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:

```js
test('citations flow through to flagged output when present', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt');
  const red = flags.find((f) => f.id === 'red40');
  assert.ok(Array.isArray(red.citations) && red.citations.length > 0, 'red40 should carry citations');
  assert.ok(red.citations[0].title, 'citation needs a title');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `red40` has no `citations` yet.

- [ ] **Step 3: Add citations to high-value entries**

In `server/data/inflammatoryIngredients.js`, add a `citations` array to the `red40`, `yellow5`, and `sodiumbenzoate` entries. Use the real, well-known references below:

For `red40`:
```js
    citations: [
      { title: 'McCann et al., "Food additives and hyperactive behaviour" — The Lancet (2007)', url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(07)61306-3/fulltext' },
      { title: 'FDA — Color Additives in Foods', url: 'https://www.fda.gov/food/food-additives-petitions/color-additives-foods' },
    ],
```

For `yellow5`:
```js
    citations: [
      { title: 'McCann et al., "Food additives and hyperactive behaviour" — The Lancet (2007)', url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(07)61306-3/fulltext' },
    ],
```

For `sodiumbenzoate`:
```js
    citations: [
      { title: 'McCann et al., "Food additives and hyperactive behaviour" — The Lancet (2007)', url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(07)61306-3/fulltext' },
    ],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS (full suite green).

- [ ] **Step 5: Commit**

```bash
git add server/data/inflammatoryIngredients.js server/utils/ingredientMatcher.test.js
git commit -m "feat(server): add study citations to key flagged ingredients"
```

---

## Phase B — Server wiring (Firestore + routes)

### Task 7: Firestore helpers for user match data

**Files:**
- Create: `server/utils/userMatchData.js`

- [ ] **Step 1: Create the helper module**

Create `server/utils/userMatchData.js`:

```js
const admin = require('./firebaseAdmin');

function userRef(uid) {
  return admin.firestore().collection('users').doc(uid);
}

async function getPersonalAllergens(uid) {
  const snap = await userRef(uid).collection('allergens').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getDismissedIds(uid) {
  const snap = await userRef(uid).collection('dismissedFlags').get();
  return new Set(snap.docs.map((d) => d.id));
}

async function addDismissedFlag(uid, ingredientId) {
  await userRef(uid)
    .collection('dismissedFlags')
    .doc(ingredientId)
    .set({ ingredientId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

// Convenience: both reads in parallel for a scan
async function getMatchOptions(uid) {
  const [personalAllergens, dismissedIds] = await Promise.all([
    getPersonalAllergens(uid),
    getDismissedIds(uid),
  ]);
  return { personalAllergens, dismissedIds };
}

module.exports = { getPersonalAllergens, getDismissedIds, addDismissedFlag, getMatchOptions };
```

- [ ] **Step 2: Sanity-check it loads (no syntax errors)**

Run: `cd server && node -e "require('./utils/userMatchData'); console.log('ok')"`
Expected: prints `ok` (Firebase Admin init may log a warning if env is absent locally — that is fine; we only require the module).

- [ ] **Step 3: Commit**

```bash
git add server/utils/userMatchData.js
git commit -m "feat(server): Firestore helpers for allergens + dismissed flags"
```

> **Verification note:** These are thin Firestore I/O wrappers with no branching logic; they are exercised end-to-end by the manual test in Task 14 rather than by unit tests (no mocking harness in this repo).

---

### Task 8: Wire user data into all scan routes

**Files:**
- Modify: `server/routes/scan.js`

- [ ] **Step 1: Import the helper**

At the top of `server/routes/scan.js`, below the existing `matchIngredients` import, add:

```js
const { getMatchOptions, addDismissedFlag } = require('../utils/userMatchData');
```

- [ ] **Step 2: Pass match options in `/image` (barcode branch)**

In `router.post('/image', ...)`, the barcode branch currently calls:
```js
      const flagged = matchIngredients(rawIngredients);
```
Replace with:
```js
      const matchOptions = await getMatchOptions(req.uid);
      const flagged = matchIngredients(rawIngredients, matchOptions);
```

- [ ] **Step 3: Pass match options in `/image` (OCR branch)**

Further down in the same handler:
```js
    const ingredientsText = extractIngredientsSection(rawText);
    const flagged = matchIngredients(ingredientsText);
```
Replace with:
```js
    const ingredientsText = extractIngredientsSection(rawText);
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(ingredientsText, matchOptions);
```

- [ ] **Step 4: Pass match options in `/text`**

In `router.post('/text', ...)`:
```js
  const flagged = matchIngredients(text);
```
Replace with:
```js
  const matchOptions = await getMatchOptions(req.uid);
  const flagged = matchIngredients(text, matchOptions);
```

- [ ] **Step 5: Pass match options in `/barcode/:upc`**

In `router.get('/barcode/:upc', ...)`:
```js
    const flagged = matchIngredients(rawIngredients);
```
Replace with:
```js
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(rawIngredients, matchOptions);
```

- [ ] **Step 6: Verify the file still parses**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 7: Commit**

```bash
git add server/routes/scan.js
git commit -m "feat(server): apply personal allergens + dismissals to all scans"
```

---

### Task 9: `POST /scan/dismiss` endpoint

**Files:**
- Modify: `server/routes/scan.js`

- [ ] **Step 1: Add the route**

In `server/routes/scan.js`, immediately before `module.exports = router;`, add:

```js
router.post('/dismiss', requireAuth, async (req, res) => {
  const { ingredientId } = req.body;
  if (!ingredientId || typeof ingredientId !== 'string') {
    return res.status(400).json({ error: 'ingredientId required' });
  }
  try {
    await addDismissedFlag(req.uid, ingredientId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Dismiss error:', err.message);
    res.status(500).json({ error: 'Failed to dismiss flag' });
  }
});
```

- [ ] **Step 2: Verify the file still parses**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/scan.js
git commit -m "feat(server): POST /scan/dismiss to silence a flag per user"
```

---

### Task 10: `POST /scan/rematch` endpoint (no scan charge)

**Files:**
- Modify: `server/routes/scan.js`

- [ ] **Step 1: Add the route**

In `server/routes/scan.js`, immediately before `module.exports = router;`, add:

```js
// Re-run matching on already-stored text (e.g. history views). Does NOT consume a scan.
router.post('/rematch', requireAuth, async (req, res) => {
  const { rawText } = req.body;
  if (typeof rawText !== 'string') {
    return res.status(400).json({ error: 'rawText required' });
  }
  if (!rawText.trim()) return res.json({ flagged: [] });
  try {
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(rawText, matchOptions);
    res.json({ flagged });
  } catch (err) {
    console.error('Rematch error:', err.message);
    res.status(500).json({ error: 'Failed to rematch' });
  }
});
```

- [ ] **Step 2: Verify the file still parses**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/scan.js
git commit -m "feat(server): POST /scan/rematch for live history re-evaluation"
```

---

## Phase C — Client

> No automated client test harness exists; each client task ends with explicit manual verification. Run the app with `cd web && npm run dev` and the server with `cd server && npm run dev`.

### Task 11: API client methods

**Files:**
- Modify: `web/src/api.js`

- [ ] **Step 1: Add `dismissFlag` and `rematch`**

At the end of `web/src/api.js`, add:

```js
export async function dismissFlag(ingredientId) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/dismiss`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ingredientId }),
  }));
}

export async function rematch(rawText) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/rematch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText }),
  }));
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds with no import errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/api.js
git commit -m "feat(web): add dismissFlag and rematch API calls"
```

---

### Task 12: ResultsScreen — three sections, dismiss, sources

**Files:**
- Rewrite: `web/src/ResultsScreen.jsx`
- Modify: `web/src/ResultsScreen.css`

- [ ] **Step 1: Rewrite `ResultsScreen.jsx`**

Replace the entire contents of `web/src/ResultsScreen.jsx`:

```jsx
import { useState } from 'react';
import './ResultsScreen.css';
import { dismissFlag } from './api';

function SeverityBadge({ tier, severity }) {
  if (tier === 'possible') {
    return <span className="flag-severity flag-severity-possible">Worth checking</span>;
  }
  return (
    <span className={`flag-severity flag-severity-${severity}`}>
      {severity === 'high' ? 'High concern' : 'Moderate concern'}
    </span>
  );
}

function Sources({ citations }) {
  const [open, setOpen] = useState(false);
  if (!citations || citations.length === 0) return null;
  return (
    <div className="card-sources">
      <button className="card-sources-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide sources' : 'Sources'}
      </button>
      {open && (
        <ul className="card-sources-list">
          {citations.map((c, i) => (
            <li key={i}>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
              ) : (
                c.title
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IngredientCard({ item, index, onDismiss }) {
  const isHigh = item.severity === 'high';
  const isPossible = item.tier === 'possible';
  const cardClass = isPossible ? 'card-possible' : isHigh ? 'card-high' : 'card-moderate';
  return (
    <div className={`card ${cardClass}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-top">
        <div className="card-text">
          <span className="card-flag">{item.flag}</span>
          <span className="card-matched">Found as: {item.matchedOn}</span>
        </div>
        <SeverityBadge tier={item.tier} severity={item.severity} />
      </div>
      <p className="card-explanation">{item.explanation}</p>
      <Sources citations={item.citations} />
      <button className="card-dismiss" onClick={() => onDismiss(item.id)}>
        Not a concern
      </button>
    </div>
  );
}

export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { flagged = [], rawText = '', productName } = result;
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  async function handleDismiss(id) {
    setDismissedIds((prev) => new Set(prev).add(id)); // optimistic hide
    try {
      await dismissFlag(id);
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  }

  // Backward-compat: old stored scans lack tier/source
  const visible = flagged
    .filter((f) => !dismissedIds.has(f.id))
    .map((f) => ({ ...f, tier: f.tier || 'confident', source: f.source || 'curated' }));

  const personal = visible.filter((f) => f.source === 'personal' && f.tier !== 'possible');
  const curated = visible.filter((f) => f.source === 'curated' && f.tier !== 'possible');
  const possible = visible.filter((f) => f.tier === 'possible');

  const highCount = visible.filter((i) => i.severity === 'high' && i.tier !== 'possible').length;
  const modCount = visible.filter((i) => i.severity === 'moderate' && i.tier !== 'possible').length;
  const allClear = visible.length === 0;

  let cardIndex = 0;

  return (
    <div className="results-root">
      <div className="results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
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
              {allClear ? 'No flags found' : `${visible.length} ingredient${visible.length !== 1 ? 's' : ''} flagged`}
            </p>
            <p className="banner-sub">
              {allClear
                ? 'No known inflammatory ingredients detected.'
                : [highCount > 0 && `${highCount} high concern`, modCount > 0 && `${modCount} moderate concern`, possible.length > 0 && `${possible.length} worth checking`]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
        </div>

        {personal.length > 0 && (
          <section className="results-section">
            <h2 className="section-title section-title-allergen">Personal Allergens</h2>
            <div className="cards">
              {personal.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        {curated.length > 0 && (
          <section className="results-section">
            <h2 className="section-title">Flagged Ingredients</h2>
            <div className="cards">
              {curated.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        {possible.length > 0 && (
          <section className="results-section">
            <h2 className="section-title section-title-possible">Worth Checking</h2>
            <div className="cards">
              {possible.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
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

- [ ] **Step 2: Add CSS for the new tier, dismiss button, and sources**

Append to `web/src/ResultsScreen.css`:

```css
/* Worth Checking (possible) tier */
.section-title-possible { color: #6b7280; }
.card-possible {
  border-left: 4px solid #9ca3af;
  background: #f9fafb;
}
.flag-severity-possible {
  background: #e5e7eb;
  color: #4b5563;
}

/* Sources disclosure */
.card-sources { margin-top: 8px; }
.card-sources-toggle {
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
}
.card-sources-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: #4b5563;
}
.card-sources-list a { color: #2563eb; }

/* Not a concern (dismiss) */
.card-dismiss {
  margin-top: 10px;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
}
.card-dismiss:hover { background: #f3f4f6; }
```

- [ ] **Step 3: Manual verification**

With server + web dev servers running:
1. Add a personal allergen "onion" (Allergy) via My Allergens.
2. Scan/enter text containing `Onion Powder, Coconut Milk, FD&C Red No. 40, Soy Lecithin, Maltodextrin`.
3. Confirm: **Onion** appears under *Personal Allergens* (High); **Red 40** under *Flagged Ingredients*; **Soy** under *Worth Checking*; **no** dairy flag (coconut milk) and **no** gluten flag (maltodextrin).
4. Click "Sources" on Red 40 → citation link shows.
5. Click "Not a concern" on Red 40 → card disappears immediately.
6. Re-scan the same text → Red 40 stays gone (persisted dismissal).

- [ ] **Step 4: Commit**

```bash
git add web/src/ResultsScreen.jsx web/src/ResultsScreen.css
git commit -m "feat(web): three-tier results with dismiss and sources"
```

---

### Task 13: History live re-evaluation via rematch

**Files:**
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Import `rematch`**

In `web/src/App.jsx`, find the existing import of API functions (e.g. `from './api'`) and add `rematch` to it. If there is no existing `./api` import in this file, add:

```js
import { rematch } from './api';
```

- [ ] **Step 2: Re-match on history load**

In `HistoryScanRoute`, replace the existing `useEffect` that loads the scan with a version that refreshes flags via `rematch` after the scan is loaded:

```jsx
  useEffect(() => {
    let cancelled = false;

    async function refreshFlags(loaded) {
      if (!loaded?.rawText) return loaded;
      try {
        const { flagged } = await rematch(loaded.rawText);
        return { ...loaded, flagged };
      } catch (e) {
        console.error('Rematch failed, showing stored flags', e);
        return loaded;
      }
    }

    if (state?.scan) {
      refreshFlags(state.scan).then((s) => { if (!cancelled) setScan(s); });
      return () => { cancelled = true; };
    }

    getDoc(doc(db, 'users', user.uid, 'scans', scanId))
      .then(async (d) => {
        if (cancelled) return;
        if (d.exists()) {
          const loaded = { id: d.id, ...d.data() };
          const refreshed = await refreshFlags(loaded);
          if (!cancelled) setScan(refreshed);
        } else {
          navigate('/history', { replace: true });
        }
      })
      .catch(() => navigate('/history', { replace: true }))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [scanId]);
```

- [ ] **Step 3: Manual verification**

1. Complete a scan (it saves to history).
2. Open My Allergens and add an allergen that appears in that scan's ingredients.
3. Open the scan from History → confirm the newly added personal allergen now appears (live re-evaluation), and any dismissed flags stay hidden.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.jsx
git commit -m "feat(web): re-evaluate history scans against current allergens/dismissals"
```

---

### Task 14: Remove the client matcher + full manual pass

**Files:**
- Delete: `web/src/allergenMatcher.js`

- [ ] **Step 1: Confirm no remaining importers**

Run: `grep -rn "allergenMatcher\|matchAllergens" web/src`
Expected: **no matches** (Task 12 removed the `ResultsScreen` import). If any remain, remove them before deleting the file.

- [ ] **Step 2: Delete the file**

```bash
git rm web/src/allergenMatcher.js
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds with no unresolved imports.

- [ ] **Step 4: Full manual regression**

With both dev servers running, verify end to end:
1. Fresh scan with mixed ingredients (dye, dairy red-herring "coconut milk", gluten red-herring "maltodextrin", a personal-allergen variant, an ambiguous "soy lecithin").
2. Correct sectioning (Personal / Flagged / Worth Checking), correct suppressions.
3. Dismiss persists across re-scan.
4. History view reflects current allergens and dismissals.
5. A product with no flags shows the green "No flags found" banner.

- [ ] **Step 5: Run the full server test suite one more time**

Run: `cd server && npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(web): remove client-side allergen matcher (now server-side)"
```

---

## Self-Review — Spec Coverage

- Unified server-side engine → Tasks 1, 8. ✅
- Whole-word/phrase recall (onion→onion powder; not maltodextrin) → Tasks 1, 4. ✅
- Negator precision (coconut milk) → Task 2. ✅
- `possible` soft tier → Task 3, rendered Task 12. ✅
- Dismiss (global per ingredient) → Tasks 5, 7, 9; client Task 12. ✅
- Citations / Education "Sources" → Task 6 (data), Task 12 (UI). ✅
- Personal allergens through one engine + severity mapping → Task 4. ✅
- `dismissedFlags` Firestore collection → Task 7. ✅
- API response gains tier/source/citations; routes read user data → Task 8. ✅
- `POST /scan/dismiss` → Task 9. ✅
- Backward-compat for old history scans → Task 12 (defaults) + Task 13 (rematch). ✅
- Delete `web/src/allergenMatcher.js` → Task 14. ✅
- Out-of-scope items (per-child, presets, restaurant prose, caching) → not implemented, correct. ✅

No placeholders remain; type/field names (`tier`, `source`, `citations`, `dismissedIds`, `getMatchOptions`, `addDismissedFlag`, `dismissFlag`, `rematch`) are consistent across server and client tasks.
