# Profiles & Condition Presets (System 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiple per-person profiles and condition presets — each profile picks which curated categories flag (via presets it can fine-tune) plus its own allergens; one scan is evaluated against every profile and shown per-profile.

**Architecture:** Categories become stable `categoryKey`s. The matcher gains an `activeCategories` filter. Scan routes match once per profile server-side and return `profiles[]`. The client migrates the single allergen list into an invisible default profile, adds a Profiles screen + preset-seeded category editor, and renders hybrid per-profile results. WCAG 2.1 AA throughout.

**Tech Stack:** Node/Express + `node:test` (server), Firebase Admin (Firestore), React + Vite (web), Firebase Web SDK.

**Spec:** `docs/superpowers/specs/2026-07-10-profiles-condition-presets-design.md`

**Testing note:** Server pure logic is TDD'd with `node --test` (run under Node ≥18: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'` — the machine default `node` is v12 and will fail). The web client has no automated harness; client tasks end with `npm run build` + explicit manual verification (run web `npm run dev` + server `npm run dev`, both under Node 20).

---

## File Structure

**Server**
- Create `server/data/categories.js` — canonical `CATEGORIES` (key+label) + `CATEGORY_KEYS`.
- Create `server/data/presets.js` — `PRESETS` (key, label, description, categories).
- Modify `server/data/inflammatoryIngredients.js` — add `categoryKey` to every entry.
- Modify `server/utils/ingredientMatcher.js` — add `activeCategories` filter.
- Modify `server/utils/userMatchData.js` — profile-aware helpers + `matchAllProfiles`.
- Modify `server/routes/scan.js` — per-profile results; profile-aware `/dismiss` and `/rematch`.
- Modify `server/utils/ingredientMatcher.test.js` — add filter tests; create `server/data/data.test.js`.

**Client**
- Create `web/src/profileCatalog.js` — mirror of categories + presets.
- Create `web/src/migrateProfiles.js` — `ensureProfiles(uid)` lazy migration.
- Create `web/src/useProfiles.js` — `useProfiles` hook + `ProfileContext` (replaces `useAllergens`).
- Create `web/src/ProfilesScreen.jsx` + `.css` — profile list + add profile.
- Create `web/src/ProfileEditor.jsx` — presets + category switches + allergens.
- Modify `web/src/api.js` — `dismissFlag(profileId, ingredientId)`, `rematch` → `{ profiles }`.
- Modify `web/src/ResultsScreen.jsx` — hybrid per-profile.
- Modify `web/src/HomeScreen.jsx` — Profiles card.
- Modify `web/src/App.jsx` — ProfileContext, routes, `handleResult` summary, history rematch.
- Delete `web/src/useAllergens.js` and `web/src/AllergensScreen.jsx`.

---

## Phase A — Server data & matching (TDD)

### Task 1: Canonical categories module

**Files:** Create `server/data/categories.js`; Create `server/data/data.test.js`.

- [ ] **Step 1: Write the failing test**

Create `server/data/data.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { CATEGORIES, CATEGORY_KEYS } = require('./categories');

test('categories: keys are unique and non-empty', () => {
  assert.ok(CATEGORIES.length >= 11);
  const keys = CATEGORIES.map((c) => c.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'keys must be unique');
  for (const c of CATEGORIES) {
    assert.match(c.key, /^[a-z-]+$/, `key "${c.key}" must be kebab-case`);
    assert.ok(c.label && c.label.length > 0, 'label required');
  }
});

test('categories: CATEGORY_KEYS mirrors CATEGORIES keys', () => {
  assert.deepStrictEqual(CATEGORY_KEYS, CATEGORIES.map((c) => c.key));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: FAIL — `Cannot find module './categories'`.

- [ ] **Step 3: Create the module**

Create `server/data/categories.js`:
```js
// Canonical category keys used by the matcher, presets, and profile editor.
const CATEGORIES = [
  { key: 'dyes', label: 'Artificial Dyes' },
  { key: 'preservatives', label: 'Preservatives' },
  { key: 'excitotoxins', label: 'MSG & Excitotoxins' },
  { key: 'sweeteners', label: 'Artificial Sweeteners' },
  { key: 'hfcs', label: 'Added Sugars / HFCS' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'dairy', label: 'Dairy / Casein' },
  { key: 'soy', label: 'Soy' },
  { key: 'artificial-flavors', label: 'Artificial Flavors' },
  { key: 'carrageenan', label: 'Carrageenan' },
  { key: 'aluminum', label: 'Aluminum Additives' },
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

module.exports = { CATEGORIES, CATEGORY_KEYS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/data/categories.js server/data/data.test.js
git commit -m "feat(server): canonical ingredient category keys"
```

---

### Task 2: Tag every curated ingredient with a categoryKey

**Files:** Modify `server/data/inflammatoryIngredients.js`; Modify `server/data/data.test.js`.

- [ ] **Step 1: Write the failing test**

Append to `server/data/data.test.js`:
```js
const ingredients = require('./inflammatoryIngredients');
const { CATEGORY_KEYS: KEYS } = require('./categories');

test('every ingredient has a valid categoryKey', () => {
  for (const ing of ingredients) {
    assert.ok(ing.categoryKey, `ingredient "${ing.id}" missing categoryKey`);
    assert.ok(KEYS.includes(ing.categoryKey), `ingredient "${ing.id}" has unknown categoryKey "${ing.categoryKey}"`);
  }
});

test('a categoryKey exists for each of the expected mappings', () => {
  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i.categoryKey]));
  assert.strictEqual(byId.red40, 'dyes');
  assert.strictEqual(byId.bht, 'preservatives');
  assert.strictEqual(byId.msg, 'excitotoxins');
  assert.strictEqual(byId.sucralose, 'sweeteners');
  assert.strictEqual(byId.hfcs, 'hfcs');
  assert.strictEqual(byId.gluten, 'gluten');
  assert.strictEqual(byId.casein, 'dairy');
  assert.strictEqual(byId.soy, 'soy');
  assert.strictEqual(byId.artificialflavors, 'artificial-flavors');
  assert.strictEqual(byId.carrageenan, 'carrageenan');
  assert.strictEqual(byId.aluminum, 'aluminum');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: FAIL — ingredients have no `categoryKey`.

- [ ] **Step 3: Add `categoryKey` to each entry**

In `server/data/inflammatoryIngredients.js`, add a `categoryKey` field to every ingredient entry per this mapping (by `id`):

| categoryKey | ids |
|---|---|
| `dyes` | red40, yellow5, yellow6, blue1, blue2, red3, green3 |
| `preservatives` | bha, bht, sodiumbenzoate, tbhq, sodiumnitrate |
| `excitotoxins` | msg, aspartame, naturalflavors |
| `sweeteners` | sucralose, acesulfamek, saccharin |
| `hfcs` | hfcs |
| `gluten` | gluten |
| `dairy` | casein |
| `soy` | soy |
| `artificial-flavors` | artificialflavors |
| `carrageenan` | carrageenan |
| `aluminum` | aluminum |

Add the field near the top of each entry, e.g. for red40:
```js
  {
    id: 'red40',
    categoryKey: 'dyes',
    names: ['red 40', 'red40', 'allura red', 'fd&c red 40', 'fd&c red no. 40', 'red dye 40'],
    category: 'Artificial Dye',
    ...
  },
```
Do this for all 23 entries. (The display `category` string stays; `categoryKey` is the new machine key.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS (including the prior System 1 tests).

- [ ] **Step 5: Commit**
```bash
git add server/data/inflammatoryIngredients.js server/data/data.test.js
git commit -m "feat(server): tag curated ingredients with categoryKey"
```

---

### Task 3: Preset definitions

**Files:** Create `server/data/presets.js`; Modify `server/data/data.test.js`.

- [ ] **Step 1: Write the failing test**

Append to `server/data/data.test.js`:
```js
const { PRESETS } = require('./presets');

test('presets: every preset category is a valid canonical key', () => {
  for (const p of PRESETS) {
    assert.ok(p.key && p.label, `preset needs key+label`);
    assert.ok(Array.isArray(p.categories) && p.categories.length > 0);
    for (const c of p.categories) {
      assert.ok(KEYS.includes(c), `preset "${p.key}" references unknown category "${c}"`);
    }
  }
});

test('presets: autism includes all categories; focused presets are subsets', () => {
  const autism = PRESETS.find((p) => p.key === 'autism');
  assert.deepStrictEqual([...autism.categories].sort(), [...KEYS].sort());
  const dairyFree = PRESETS.find((p) => p.key === 'dairy-free');
  assert.deepStrictEqual(dairyFree.categories, ['dairy']);
  const feingold = PRESETS.find((p) => p.key === 'feingold');
  assert.deepStrictEqual([...feingold.categories].sort(), ['artificial-flavors', 'dyes', 'preservatives']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: FAIL — `Cannot find module './presets'`.

- [ ] **Step 3: Create the module**

Create `server/data/presets.js`:
```js
const { CATEGORY_KEYS } = require('./categories');

const PRESETS = [
  {
    key: 'autism',
    label: 'Autism / ASD',
    description: 'Broad — flags every curated category.',
    categories: [...CATEGORY_KEYS],
  },
  {
    key: 'feingold',
    label: 'Feingold',
    description: 'Artificial dyes, artificial flavors, and petroleum preservatives.',
    categories: ['dyes', 'artificial-flavors', 'preservatives'],
  },
  {
    key: 'gfcf',
    label: 'GFCF',
    description: 'Gluten-free, casein-free.',
    categories: ['gluten', 'dairy'],
  },
  {
    key: 'dairy-free',
    label: 'Dairy-Free',
    description: 'Casein and dairy proteins.',
    categories: ['dairy'],
  },
  {
    key: 'no-dyes',
    label: 'No Artificial Dyes',
    description: 'Synthetic color additives.',
    categories: ['dyes'],
  },
];

module.exports = { PRESETS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/data/presets.js server/data/data.test.js
git commit -m "feat(server): condition preset definitions"
```

---

### Task 4: `activeCategories` filter in the matcher

**Files:** Modify `server/utils/ingredientMatcher.js`; Modify `server/utils/ingredientMatcher.test.js`.

- [ ] **Step 1: Write the failing test**

Append to `server/utils/ingredientMatcher.test.js`:
```js
test('activeCategories: inactive category is NOT flagged', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { activeCategories: ['dairy'] });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('activeCategories: active category IS flagged', () => {
  const flags = matchIngredients('Water, Milk, Sugar', { activeCategories: ['dairy'] });
  assert.ok(flags.find((f) => f.id === 'casein'));
});

test('activeCategories: personal allergens flag regardless of categories', () => {
  const personalAllergens = [{ id: 'a1', name: 'onion', type: 'allergy' }];
  const flags = matchIngredients('Onion, Red 40', { activeCategories: ['dairy'], personalAllergens });
  assert.ok(flags.find((f) => f.id === 'a1'), 'personal allergen should still match');
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined, 'dye not active');
});

test('activeCategories: empty array flags no curated ingredients', () => {
  const flags = matchIngredients('Red 40, Milk, Wheat', { activeCategories: [] });
  assert.strictEqual(flags.length, 0);
});

test('activeCategories: omitted falls back to all curated (System 1 behavior)', () => {
  const flags = matchIngredients('Red 40, Milk');
  assert.ok(flags.find((f) => f.id === 'red40'));
  assert.ok(flags.find((f) => f.id === 'casein'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: FAIL — filter not implemented (Red 40 still flags when only dairy active).

- [ ] **Step 3: Implement the filter**

In `server/utils/ingredientMatcher.js`, inside `matchIngredients`, after the `dismissedIds` line and before `const tokens = ...`, add:
```js
  const activeCategorySet = options.activeCategories
    ? new Set(options.activeCategories)
    : null; // null = no filter (all curated), preserves System 1 behavior
```
Then in the curated loop, change:
```js
  for (const entry of ingredients) {
    if (seen.has(entry.id)) continue;
    const res = evaluateEntry(entry, tokens);
```
to:
```js
  for (const entry of ingredients) {
    if (seen.has(entry.id)) continue;
    if (activeCategorySet && !activeCategorySet.has(entry.categoryKey)) continue;
    const res = evaluateEntry(entry, tokens);
```
(Personal-allergen loop is unchanged — allergens always flag.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS (all prior tests still green).

- [ ] **Step 5: Commit**
```bash
git add server/utils/ingredientMatcher.js server/utils/ingredientMatcher.test.js
git commit -m "feat(server): activeCategories filter in matcher"
```

---

## Phase B — Server API (per-profile)

### Task 5: Profile-aware match data helpers

**Files:** Modify `server/utils/userMatchData.js`.

- [ ] **Step 1: Replace the module contents**

Replace the entire contents of `server/utils/userMatchData.js`:
```js
const admin = require('./firebaseAdmin');
const { matchIngredients } = require('./ingredientMatcher');

function userRef(uid) {
  return admin.firestore().collection('users').doc(uid);
}
function profileRef(uid, profileId) {
  return userRef(uid).collection('profiles').doc(profileId);
}

// Ordered list of profiles: { id, name, activeCategories, order }
async function getProfiles(uid) {
  const snap = await userRef(uid).collection('profiles').orderBy('order').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// A profile's allergens + dismissed ids (categories come from the profile doc)
async function getProfileFlagInputs(uid, profileId) {
  const [allergensSnap, dismissedSnap] = await Promise.all([
    profileRef(uid, profileId).collection('allergens').get(),
    profileRef(uid, profileId).collection('dismissedFlags').get(),
  ]);
  return {
    personalAllergens: allergensSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    dismissedIds: new Set(dismissedSnap.docs.map((d) => d.id)),
  };
}

function countByTier(flagged) {
  return {
    high: flagged.filter((f) => f.tier !== 'possible' && f.severity === 'high').length,
    moderate: flagged.filter((f) => f.tier !== 'possible' && f.severity === 'moderate').length,
    possible: flagged.filter((f) => f.tier === 'possible').length,
  };
}

// Match rawText against every profile. Returns [{ profileId, name, flagged, counts }]
async function matchAllProfiles(uid, rawText) {
  const profiles = await getProfiles(uid);
  return Promise.all(
    profiles.map(async (p) => {
      const inputs = await getProfileFlagInputs(uid, p.id);
      const flagged = matchIngredients(rawText, {
        activeCategories: p.activeCategories || [],
        ...inputs,
      });
      return { profileId: p.id, name: p.name ?? null, flagged, counts: countByTier(flagged) };
    })
  );
}

async function addDismissedFlag(uid, profileId, ingredientId) {
  await profileRef(uid, profileId)
    .collection('dismissedFlags')
    .doc(ingredientId)
    .set({ ingredientId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

module.exports = { getProfiles, matchAllProfiles, addDismissedFlag };
```

- [ ] **Step 2: Verify it parses**

Run: `cd server && node -e "require('./utils/userMatchData'); console.log('ok')"`
Expected: prints `ok` (a Firebase init warning may print — fine).

- [ ] **Step 3: Verify the unit suite still passes**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: PASS (this module has no direct unit tests; matcher/data tests unaffected).

- [ ] **Step 4: Commit**
```bash
git add server/utils/userMatchData.js
git commit -m "feat(server): per-profile match data helpers + matchAllProfiles"
```

---

### Task 6: Per-profile results in scan routes

**Files:** Modify `server/routes/scan.js`.

- [ ] **Step 1: Update imports**

In `server/routes/scan.js`, replace lines 3–4:
```js
const { matchIngredients } = require('../utils/ingredientMatcher');
const { getMatchOptions, addDismissedFlag } = require('../utils/userMatchData');
```
with:
```js
const { matchAllProfiles, addDismissedFlag } = require('../utils/userMatchData');
```

- [ ] **Step 2: `/image` barcode branch**

Replace:
```js
      const matchOptions = await getMatchOptions(req.uid);
      const flagged = matchIngredients(rawIngredients, matchOptions);
      const consumed = await tryConsumeScan(req.uid);
      if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
```
with:
```js
      const profiles = await matchAllProfiles(req.uid, rawIngredients);
      const consumed = await tryConsumeScan(req.uid);
      if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, profiles, flagged: profiles[0]?.flagged || [] });
```

- [ ] **Step 3: `/image` OCR branch**

Replace:
```js
    const ingredientsText = extractIngredientsSection(rawText);
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(ingredientsText, matchOptions);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ rawText, flagged, ingredientCount: flagged.length });
```
with:
```js
    const ingredientsText = extractIngredientsSection(rawText);
    const profiles = await matchAllProfiles(req.uid, ingredientsText);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ rawText, profiles, flagged: profiles[0]?.flagged || [] });
```

- [ ] **Step 4: `/text` route**

Replace:
```js
  const matchOptions = await getMatchOptions(req.uid);
  const flagged = matchIngredients(text, matchOptions);
  res.json({ rawText: text, flagged, ingredientCount: flagged.length });
```
with:
```js
  const profiles = await matchAllProfiles(req.uid, text);
  res.json({ rawText: text, profiles, flagged: profiles[0]?.flagged || [] });
```

- [ ] **Step 5: `/barcode/:upc` route**

Replace:
```js
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(rawIngredients, matchOptions);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ productName, imageUrl, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
```
with:
```js
    const profiles = await matchAllProfiles(req.uid, rawIngredients);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ productName, imageUrl, rawText: rawIngredients, profiles, flagged: profiles[0]?.flagged || [] });
```

(The three "no ingredients" early-return branches still return `flagged: []`; add `profiles: []` to each of those `res.json(...)` calls so the shape is consistent — find each `return res.json({ ... flagged: [], ingredientCount: 0 })` in this file and insert `profiles: [],` before `flagged: []`.)

- [ ] **Step 6: Verify it parses**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 7: Commit**
```bash
git add server/routes/scan.js
git commit -m "feat(server): scan routes return per-profile results"
```

---

### Task 7: Profile-aware `/dismiss` and `/rematch`

**Files:** Modify `server/routes/scan.js`.

- [ ] **Step 1: Update `/dismiss`**

Replace the whole `router.post('/dismiss', ...)` handler with:
```js
router.post('/dismiss', requireAuth, async (req, res) => {
  const { profileId, ingredientId } = req.body;
  const idOk = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  if (!idOk(profileId)) return res.status(400).json({ error: 'Invalid profileId' });
  if (!idOk(ingredientId)) return res.status(400).json({ error: 'Invalid ingredientId' });
  try {
    await addDismissedFlag(req.uid, profileId, ingredientId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Dismiss error:', err.message);
    res.status(500).json({ error: 'Failed to dismiss flag' });
  }
});
```

- [ ] **Step 2: Update `/rematch`**

Replace the whole `router.post('/rematch', ...)` handler with:
```js
// Re-run matching on already-stored text (e.g. history views). Does NOT consume a scan.
router.post('/rematch', requireAuth, async (req, res) => {
  const { rawText } = req.body;
  if (typeof rawText !== 'string') {
    return res.status(400).json({ error: 'rawText required' });
  }
  if (rawText.length > 20000) {
    return res.status(400).json({ error: 'rawText too long' });
  }
  try {
    const profiles = await matchAllProfiles(req.uid, rawText.trim() ? rawText : '');
    res.json({ profiles, flagged: profiles[0]?.flagged || [] });
  } catch (err) {
    console.error('Rematch error:', err.message);
    res.status(500).json({ error: 'Failed to rematch' });
  }
});
```

- [ ] **Step 3: Verify it parses + full suite**

Run: `cd server && node -e "require('./routes/scan'); console.log('ok')"`
Then: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'`
Expected: `ok`; all tests PASS.

- [ ] **Step 4: Commit**
```bash
git add server/routes/scan.js
git commit -m "feat(server): profile-aware /dismiss and /rematch"
```

---

## Phase C — Client data layer

### Task 8: Client catalog mirror

**Files:** Create `web/src/profileCatalog.js`.

- [ ] **Step 1: Create the mirror**

Create `web/src/profileCatalog.js` (mirrors `server/data/categories.js` + `presets.js`; categoryKeys are the contract):
```js
export const CATEGORIES = [
  { key: 'dyes', label: 'Artificial Dyes' },
  { key: 'preservatives', label: 'Preservatives' },
  { key: 'excitotoxins', label: 'MSG & Excitotoxins' },
  { key: 'sweeteners', label: 'Artificial Sweeteners' },
  { key: 'hfcs', label: 'Added Sugars / HFCS' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'dairy', label: 'Dairy / Casein' },
  { key: 'soy', label: 'Soy' },
  { key: 'artificial-flavors', label: 'Artificial Flavors' },
  { key: 'carrageenan', label: 'Carrageenan' },
  { key: 'aluminum', label: 'Aluminum Additives' },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const PRESETS = [
  { key: 'autism', label: 'Autism / ASD', description: 'Broad — flags every curated category.', categories: [...CATEGORY_KEYS] },
  { key: 'feingold', label: 'Feingold', description: 'Artificial dyes, artificial flavors, and petroleum preservatives.', categories: ['dyes', 'artificial-flavors', 'preservatives'] },
  { key: 'gfcf', label: 'GFCF', description: 'Gluten-free, casein-free.', categories: ['gluten', 'dairy'] },
  { key: 'dairy-free', label: 'Dairy-Free', description: 'Casein and dairy proteins.', categories: ['dairy'] },
  { key: 'no-dyes', label: 'No Artificial Dyes', description: 'Synthetic color additives.', categories: ['dyes'] },
];
```

- [ ] **Step 2: Commit**
```bash
git add web/src/profileCatalog.js
git commit -m "feat(web): client mirror of categories + presets"
```

---

### Task 9: Lazy migration to a default profile

**Files:** Create `web/src/migrateProfiles.js`.

- [ ] **Step 1: Create the migration**

Create `web/src/migrateProfiles.js`:
```js
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CATEGORY_KEYS } from './profileCatalog';

// If the user has no profiles yet, create one invisible default profile
// (all categories on) and copy any existing top-level allergens/dismissedFlags
// into it. Idempotent: does nothing once a profile exists. Returns true if it created one.
export async function ensureProfiles(uid) {
  const profilesSnap = await getDocs(collection(db, 'users', uid, 'profiles'));
  if (!profilesSnap.empty) return false;

  const batch = writeBatch(db);
  const defaultRef = doc(db, 'users', uid, 'profiles', 'default');
  batch.set(defaultRef, {
    name: null,
    activeCategories: CATEGORY_KEYS,
    order: 0,
    createdAt: serverTimestamp(),
  });

  const allergensSnap = await getDocs(collection(db, 'users', uid, 'allergens'));
  allergensSnap.forEach((d) => {
    batch.set(doc(db, 'users', uid, 'profiles', 'default', 'allergens', d.id), d.data());
  });

  const dismissedSnap = await getDocs(collection(db, 'users', uid, 'dismissedFlags'));
  dismissedSnap.forEach((d) => {
    batch.set(doc(db, 'users', uid, 'profiles', 'default', 'dismissedFlags', d.id), d.data());
  });

  await batch.commit();
  return true;
}
```
(The old top-level `allergens`/`dismissedFlags` docs are left in place, orphaned and unread — safe. No delete, to avoid data loss on a partial run.)

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build succeeds.

- [ ] **Step 3: Commit**
```bash
git add web/src/migrateProfiles.js
git commit -m "feat(web): lazy migration into a default profile"
```

---

### Task 10: `useProfiles` hook + context

**Files:** Create `web/src/useProfiles.js`.

- [ ] **Step 1: Create the hook**

Create `web/src/useProfiles.js`:
```js
import { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ensureProfiles } from './migrateProfiles';
import { CATEGORY_KEYS } from './profileCatalog';

export const ProfileContext = createContext({
  profiles: [],
  loading: true,
});

export function useProfileContext() {
  return useContext(ProfileContext);
}

export function useProfiles(user) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfiles([]); setLoading(false); return; }
    let unsub = () => {};
    let cancelled = false;
    ensureProfiles(user.uid)
      .catch((e) => console.error('Profile migration failed:', e))
      .finally(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          query(collection(db, 'users', user.uid, 'profiles'), orderBy('order')),
          (snap) => { setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
          (err) => { console.error('Failed to load profiles:', err); setLoading(false); }
        );
      });
    return () => { cancelled = true; unsub(); };
  }, [user?.uid]);

  async function addProfile(name) {
    await addDoc(collection(db, 'users', user.uid, 'profiles'), {
      name: name?.trim() || null,
      activeCategories: CATEGORY_KEYS,
      order: profiles.length,
      createdAt: serverTimestamp(),
    });
  }
  async function renameProfile(id, name) {
    await updateDoc(doc(db, 'users', user.uid, 'profiles', id), { name: name?.trim() || null });
  }
  async function setActiveCategories(id, categories) {
    await updateDoc(doc(db, 'users', user.uid, 'profiles', id), { activeCategories: categories });
  }
  async function deleteProfile(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'profiles', id));
  }
  async function addAllergen(profileId, { name, type }) {
    await addDoc(collection(db, 'users', user.uid, 'profiles', profileId, 'allergens'), {
      name: name.toLowerCase().trim(), type, createdAt: serverTimestamp(),
    });
  }
  async function removeAllergen(profileId, allergenId) {
    await deleteDoc(doc(db, 'users', user.uid, 'profiles', profileId, 'allergens', allergenId));
  }

  return { profiles, loading, addProfile, renameProfile, setActiveCategories, deleteProfile, addAllergen, removeAllergen };
}
```

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build succeeds (unused-import warnings are OK; the hook is wired in Task 11).

- [ ] **Step 3: Commit**
```bash
git add web/src/useProfiles.js
git commit -m "feat(web): useProfiles hook + ProfileContext"
```

---

### Task 11: Wire ProfileContext, api signatures, history, scan-save

**Files:** Modify `web/src/api.js`, `web/src/App.jsx`.

- [ ] **Step 1: Update `api.js` dismiss + rematch**

In `web/src/api.js`, replace the `dismissFlag` function with:
```js
export async function dismissFlag(profileId, ingredientId) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ profileId, ingredientId }),
  }));
}
```
(`rematch` is unchanged in signature; it now returns `{ profiles, flagged }` — no code change needed here.)

- [ ] **Step 2: Swap the context provider in `App.jsx`**

In `web/src/App.jsx`:
- Replace the import `import { useAllergens, AllergenContext } from './useAllergens';` with `import { useProfiles, ProfileContext } from './useProfiles';`
- Replace `import AllergensScreen from './AllergensScreen';` with `import ProfilesScreen from './ProfilesScreen';`
- In `AppRoutes`, replace `const allergenAPI = useAllergens(user);` with `const profileAPI = useProfiles(user);`
- Replace both `<AllergenContext.Provider value={allergenAPI}>` / `</AllergenContext.Provider>` occurrences (the loading branch and the routes branch) with `<ProfileContext.Provider value={profileAPI}>` / `</ProfileContext.Provider>`.

- [ ] **Step 3: Rename the route + home callback**

In `web/src/App.jsx`:
- In `HomeRoute`, rename the prop `onAllergens` → `onProfiles` (both the destructure and the JSX pass-through).
- In the `/home` route element, change `onAllergens={() => navigate('/allergens')}` to `onProfiles={() => navigate('/profiles')}`.
- Replace the entire `/allergens` `<Route>` block with:
```jsx
        <Route
          path="/profiles"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ProfilesScreen onBack={() => navigate('/home')} />
            </RequireAuth>
          }
        />
```

- [ ] **Step 4: History rematch → per-profile; scan-save summary**

In `HistoryScanRoute`'s `refreshFlags`, replace:
```js
      try {
        const { flagged } = await rematch(loaded.rawText);
        return { ...loaded, flagged };
      } catch (e) {
```
with:
```js
      try {
        const { profiles, flagged } = await rematch(loaded.rawText);
        return { ...loaded, profiles, flagged };
      } catch (e) {
```

In `handleResult`, replace the `await setDoc(scanRef, { ... })` object with:
```js
        await setDoc(scanRef, {
          createdAt: serverTimestamp(),
          mode: src,
          productName: data.productName || null,
          rawText: data.rawText || '',
          flagged: data.flagged || [],
          summary: {
            flaggedProfileCount: (data.profiles || []).filter((p) => (p.flagged || []).length > 0).length,
            totalProfiles: (data.profiles || []).length,
          },
          imageUrl,
        });
```

- [ ] **Step 5: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build FAILS only if `ProfilesScreen` doesn't exist yet — it's created in Task 12. If you are executing strictly in order, temporarily expect this build to fail on the missing import; it passes after Task 12. (If you prefer a green build here, do Task 12 before this step's build.)

- [ ] **Step 6: Commit**
```bash
git add web/src/api.js web/src/App.jsx
git commit -m "feat(web): wire ProfileContext, /profiles route, per-profile history + scan summary"
```

---

## Phase D — Client UI

### Task 12: Profiles screen + editor

**Files:** Create `web/src/ProfilesScreen.jsx`, `web/src/ProfilesScreen.css`, `web/src/ProfileEditor.jsx`. Delete `web/src/AllergensScreen.jsx`.

- [ ] **Step 1: Create `ProfileEditor.jsx`**

Create `web/src/ProfileEditor.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useProfileContext } from './useProfiles';
import { CATEGORIES, PRESETS } from './profileCatalog';

function AllergenAddSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('allergy');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), type }); }
    catch (e) { console.error(e); setSaving(false); }
  }
  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add ingredient">
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Add ingredient</h2>
        <label htmlFor="allergen-name" className="pe-label">Ingredient name</label>
        <input id="allergen-name" className="allergen-input" placeholder="e.g. onion" value={name}
          onChange={(e) => setName(e.target.value)} maxLength={50} autoFocus />
        <div className="allergen-type-row" role="radiogroup" aria-label="Concern level">
          <button role="radio" aria-checked={type === 'allergy'}
            className={`allergen-type-btn ${type === 'allergy' ? 'allergen-type-btn-active-high' : ''}`}
            onClick={() => setType('allergy')}>Allergy</button>
          <button role="radio" aria-checked={type === 'sensitivity'}
            className={`allergen-type-btn ${type === 'sensitivity' ? 'allergen-type-btn-active-mod' : ''}`}
            onClick={() => setType('sensitivity')}>Sensitivity</button>
        </div>
        <button className="allergen-save-btn" onClick={save} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export default function ProfileEditor({ profile, onClose }) {
  const { renameProfile, setActiveCategories, addAllergen, removeAllergen, deleteProfile, profiles } = useProfileContext();
  const active = new Set(profile.activeCategories || []);
  const [allergens, setAllergens] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'profiles', profile.id, 'allergens'),
      (snap) => setAllergens(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [profile.id]);

  function applyPreset(preset) { setActiveCategories(profile.id, preset.categories); }
  function toggleCategory(key) {
    const next = new Set(active);
    next.has(key) ? next.delete(key) : next.add(key);
    setActiveCategories(profile.id, [...next]);
  }

  return (
    <div className="pe-root">
      <div className="pe-header">
        <button className="pe-back" onClick={onClose} aria-label="Back to profiles">‹ Back</button>
        <h1 className="pe-title">Edit profile</h1>
      </div>
      <div className="pe-scroll">
        <label htmlFor="pe-name" className="pe-label">Profile name</label>
        <input id="pe-name" className="allergen-input" placeholder="e.g. Emma (optional)"
          defaultValue={profile.name || ''} maxLength={40}
          onBlur={(e) => renameProfile(profile.id, e.target.value)} />

        <p className="pe-section-label">Quick presets</p>
        <div className="pe-presets">
          {PRESETS.map((p) => (
            <button key={p.key} className="pe-preset" onClick={() => applyPreset(p)}
              aria-label={`Apply ${p.label} preset — ${p.description}`}>{p.label}</button>
          ))}
        </div>

        <p className="pe-section-label">Flag these categories</p>
        <div className="pe-switches">
          {CATEGORIES.map((c) => {
            const on = active.has(c.key);
            return (
              <button key={c.key} role="switch" aria-checked={on}
                className={`pe-switch ${on ? 'pe-switch-on' : ''}`} onClick={() => toggleCategory(c.key)}>
                <span className="pe-switch-label">{c.label}</span>
                <span className="pe-switch-state">{on ? 'On' : 'Off'}</span>
              </button>
            );
          })}
        </div>

        <p className="pe-section-label">Custom allergens</p>
        {allergens.length === 0 && <p className="pe-empty">None added.</p>}
        {allergens.map((a) => (
          <div key={a.id} className="pe-allergen-row">
            <span>{a.name} <span className="pe-allergen-type">{a.type === 'allergy' ? 'Allergy' : 'Sensitivity'}</span></span>
            <button className="pe-allergen-remove" onClick={() => removeAllergen(profile.id, a.id)}
              aria-label={`Remove ${a.name}`}>×</button>
          </div>
        ))}
        <button className="pe-add-allergen" onClick={() => setShowAdd(true)}>+ Add allergen</button>

        {profiles.length > 1 && (
          <button className="pe-delete" onClick={() => { deleteProfile(profile.id); onClose(); }}>
            Delete this profile
          </button>
        )}
      </div>
      {showAdd && (
        <AllergenAddSheet onClose={() => setShowAdd(false)}
          onSave={async (item) => { await addAllergen(profile.id, item); setShowAdd(false); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `ProfilesScreen.jsx`**

Create `web/src/ProfilesScreen.jsx`:
```jsx
import { useState } from 'react';
import './ProfilesScreen.css';
import './AllergensScreen.css'; // reuse sheet/input styles
import { useProfileContext } from './useProfiles';
import ProfileEditor from './ProfileEditor';

export default function ProfilesScreen({ onBack }) {
  const { profiles, addProfile } = useProfileContext();
  const [editingId, setEditingId] = useState(null);
  const editing = profiles.find((p) => p.id === editingId);

  if (editing) return <ProfileEditor profile={editing} onClose={() => setEditingId(null)} />;

  const multi = profiles.length > 1;

  return (
    <div className="profiles-root">
      <div className="profiles-header">
        <button className="profiles-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="profiles-title">Profiles</h1>
      </div>
      <div className="profiles-scroll">
        {profiles.map((p) => {
          const label = p.name || (multi ? 'Unnamed profile' : 'Your profile');
          const needsName = multi && !p.name;
          return (
            <button key={p.id} className="profile-row" onClick={() => setEditingId(p.id)}>
              <span className="profile-row-name">{label}</span>
              <span className="profile-row-sub">
                {needsName ? 'Tap to name' : `${(p.activeCategories || []).length} categories flagged`}
              </span>
            </button>
          );
        })}
        <button className="profiles-add" onClick={async () => {
          await addProfile('');
        }}>+ Add profile</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `ProfilesScreen.css`**

Create `web/src/ProfilesScreen.css`:
```css
.profiles-root { display:flex; flex-direction:column; height:100dvh; background:var(--bg); }
.profiles-header { display:flex; align-items:center; gap:12px; padding:16px; }
.profiles-back { background:none; border:none; font-size:16px; color:var(--sage,#3a7); cursor:pointer; }
.profiles-title { font-size:22px; margin:0; }
.profiles-scroll { flex:1; overflow-y:auto; padding:0 16px 24px; }
.profile-row { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%;
  text-align:left; background:#fff; border:1px solid var(--border,#e5e7eb); border-radius:12px;
  padding:14px 16px; margin-bottom:10px; cursor:pointer; }
.profile-row-name { font-size:16px; font-weight:600; }
.profile-row-sub { font-size:13px; color:#6b7280; }
.profiles-add { width:100%; padding:14px; border:1px dashed #cbd5e1; border-radius:12px;
  background:none; color:#374151; font-size:15px; cursor:pointer; }
/* editor */
.pe-root { display:flex; flex-direction:column; height:100dvh; background:var(--bg); }
.pe-header { display:flex; align-items:center; gap:12px; padding:16px; }
.pe-back { background:none; border:none; font-size:16px; color:var(--sage,#3a7); cursor:pointer; }
.pe-title { font-size:20px; margin:0; }
.pe-scroll { flex:1; overflow-y:auto; padding:0 16px 32px; }
.pe-label { display:block; font-size:13px; color:#6b7280; margin:12px 0 6px; }
.pe-section-label { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; margin:20px 0 8px; }
.pe-presets { display:flex; flex-wrap:wrap; gap:8px; }
.pe-preset { padding:8px 12px; border:1px solid var(--border,#e5e7eb); border-radius:999px;
  background:#fff; font-size:14px; cursor:pointer; }
.pe-preset:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
.pe-switches { display:flex; flex-direction:column; gap:8px; }
.pe-switch { display:flex; justify-content:space-between; align-items:center; width:100%;
  padding:12px 14px; border:1px solid var(--border,#e5e7eb); border-radius:10px; background:#fff; cursor:pointer; }
.pe-switch-on { border-color:#15803d; background:#f0fdf4; }
.pe-switch-state { font-size:13px; font-weight:700; color:#6b7280; }
.pe-switch-on .pe-switch-state { color:#15803d; }
.pe-switch:focus-visible, .profile-row:focus-visible, .profiles-add:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
.pe-allergen-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; }
.pe-allergen-type { font-size:12px; color:#6b7280; margin-left:6px; }
.pe-allergen-remove { background:none; border:none; font-size:20px; color:#9ca3af; cursor:pointer; }
.pe-add-allergen { margin-top:10px; background:none; border:1px dashed #cbd5e1; border-radius:10px; padding:10px 14px; cursor:pointer; }
.pe-empty { color:#9ca3af; font-size:14px; }
.pe-delete { margin-top:28px; width:100%; padding:12px; border:1px solid #fecaca; color:#b91c1c;
  background:#fff; border-radius:10px; cursor:pointer; }
```

- [ ] **Step 4: Delete the old allergens screen**

```bash
git rm web/src/AllergensScreen.jsx
```
(Keep `web/src/AllergensScreen.css` — `ProfileEditor`'s add-sheet reuses its `.allergen-*` classes.)

- [ ] **Step 5: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build succeeds.

- [ ] **Step 6: Commit**
```bash
git add web/src/ProfilesScreen.jsx web/src/ProfilesScreen.css web/src/ProfileEditor.jsx web/src/AllergensScreen.jsx
git commit -m "feat(web): Profiles screen + preset-seeded category editor"
```

---

### Task 13: Home screen Profiles card

**Files:** Modify `web/src/HomeScreen.jsx`.

- [ ] **Step 1: Swap the context + card**

In `web/src/HomeScreen.jsx`:
- Replace `import { useAllergenContext } from './useAllergens';` with `import { useProfileContext } from './useProfiles';`
- Change the signature `export default function HomeScreen({ user, onScan, onHistory, onAllergens, onUpgrade })` → replace `onAllergens` with `onProfiles`.
- Replace `const { allergens } = useAllergenContext();` with `const { profiles } = useProfileContext();`
- Replace the entire "My Allergens" `<button className="home-card home-card-allergens" ...>` block with:
```jsx
          <button className="home-card home-card-allergens" onClick={onProfiles}>
            <span className="home-card-icon"><ShieldIcon /></span>
            <span className="home-card-label">Profiles</span>
            <span className="home-card-desc">
              {profiles.length <= 1
                ? 'Customize what’s flagged'
                : profiles.map((p) => p.name || 'Unnamed').join(', ')}
            </span>
            {profiles.length > 1 && (
              <span className="home-allergen-badge">{profiles.length}</span>
            )}
          </button>
```

- [ ] **Step 2: Verify build**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'`
Expected: build succeeds.

- [ ] **Step 3: Commit**
```bash
git add web/src/HomeScreen.jsx
git commit -m "feat(web): Home screen Profiles card"
```

---

### Task 14: Hybrid per-profile results

**Files:** Modify `web/src/ResultsScreen.jsx`, `web/src/ResultsScreen.css`.

- [ ] **Step 1: Rewrite the default export section**

In `web/src/ResultsScreen.jsx`, keep `SeverityBadge`, `Sources`, and `IngredientCard` exactly as-is (`IngredientCard` already calls `onDismiss(item.id)` — the parent now binds the `profileId`, so no change to that component is needed).

Replace the entire `export default function ResultsScreen(...) { ... }` with:
```jsx
function ProfileFlags({ profileId, flagged, onDismiss }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  async function handle(id) {
    setDismissed((prev) => new Set(prev).add(id));
    try { await onDismiss(profileId, id); } catch (e) { console.error('Dismiss failed:', e); }
  }
  const visible = flagged
    .filter((f) => !dismissed.has(f.id))
    .map((f) => ({ ...f, tier: f.tier || 'confident', source: f.source || 'curated' }));
  const personal = visible.filter((f) => f.source === 'personal' && f.tier !== 'possible');
  const curated = visible.filter((f) => f.source === 'curated' && f.tier !== 'possible');
  const possible = visible.filter((f) => f.tier === 'possible');
  let idx = 0;
  if (visible.length === 0) {
    return <div className="banner banner-safe"><span className="banner-icon">✓</span>
      <div><p className="banner-title">No flags found</p>
      <p className="banner-sub">Nothing on this profile’s list was detected.</p></div></div>;
  }
  return (
    <>
      {personal.length > 0 && (
        <section className="results-section">
          <h2 className="section-title section-title-allergen">Personal Allergens</h2>
          <div className="cards">{personal.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
      {curated.length > 0 && (
        <section className="results-section">
          <h2 className="section-title">Flagged Ingredients</h2>
          <div className="cards">{curated.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
      {possible.length > 0 && (
        <section className="results-section">
          <h2 className="section-title section-title-possible">Worth Checking</h2>
          <div className="cards">{possible.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
    </>
  );
}

export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { rawText = '', productName } = result;
  // Normalize to a profiles array (back-compat: wrap a bare `flagged`)
  const profiles = result.profiles && result.profiles.length
    ? result.profiles
    : [{ profileId: 'default', name: null, flagged: result.flagged || [] }];
  const [selectedId, setSelectedId] = useState(profiles[0].profileId);
  const selected = profiles.find((p) => p.profileId === selectedId) || profiles[0];
  const multi = profiles.length > 1;

  async function onDismiss(profileId, ingredientId) {
    await dismissFlag(profileId, ingredientId);
  }

  return (
    <div className="results-root">
      <div className="results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
        )}
        {imageUrl && <div className="results-photo-wrap"><img src={imageUrl} alt="Scanned item" className="results-photo" /></div>}
        <div className="results-header">
          {productName && <h1 className="results-product">{productName}</h1>}
          <p className="results-source">{source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}</p>
        </div>

        {multi && (
          <div className="profile-chips" role="tablist" aria-label="Profiles">
            {profiles.map((p) => {
              const count = (p.flagged || []).length;
              const name = p.name || 'Unnamed';
              const isSel = p.profileId === selectedId;
              return (
                <button key={p.profileId} role="tab" aria-selected={isSel}
                  className={`profile-chip ${count > 0 ? 'profile-chip-flagged' : 'profile-chip-safe'} ${isSel ? 'profile-chip-sel' : ''}`}
                  onClick={() => setSelectedId(p.profileId)}>
                  {name} — {count > 0 ? `${count} flagged` : 'safe'}
                </button>
              );
            })}
          </div>
        )}

        <ProfileFlags profileId={selected.profileId} flagged={selected.flagged || []} onDismiss={onDismiss} />

        {rawText && (
          <section className="results-section results-section-raw">
            <p className="raw-label">Full ingredient text</p>
            <p className="raw-text">{rawText}</p>
          </section>
        )}
        <p className="disclaimer">For informational purposes only. Not a substitute for medical or nutritional advice. Always consult a qualified professional.</p>
      </div>
      <div className="results-footer">
        <button className="scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
      </div>
    </div>
  );
}
```
(Note: `IngredientCard`'s `onDismiss` now receives just the `ingredientId`; `ProfileFlags` binds the `profileId`.)

- [ ] **Step 2: Append profile-chip CSS**

Append to `web/src/ResultsScreen.css`:
```css
.profile-chips { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 4px; }
.profile-chip { padding:8px 12px; border-radius:999px; border:1px solid var(--border,#e5e7eb);
  background:#fff; font-size:14px; font-weight:600; cursor:pointer; }
.profile-chip-flagged { border-color:#fca5a5; color:#b91c1c; }
.profile-chip-safe { border-color:#86efac; color:#15803d; }
.profile-chip-sel { outline:2px solid #2563eb; outline-offset:1px; }
.profile-chip:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
```

- [ ] **Step 3: Manual verification**

Run web (`cd web && npm run dev` under Node 20) + server (`cd server && npm run dev` under Node 20 with `FIREBASE_SERVICE_ACCOUNT` set). Then:
1. Solo profile: scan a product → single verdict, no chips (identical to before).
2. Add a second profile named "Liam" set to **Dairy-Free** only; keep default on **Autism**. Scan a product with Red 40 + Milk:
   - Chips show two profiles with text status ("… — N flagged" / "… — safe"), not color alone.
   - Selecting the Dairy-Free profile shows only the dairy flag (no Red 40); selecting the Autism profile shows both.
3. "Not a concern" on a flag hides it and persists for that profile (re-scan confirms).
4. Keyboard: Tab to chips and switches, Enter/Space toggles; focus ring visible.

- [ ] **Step 4: Commit**
```bash
git add web/src/ResultsScreen.jsx web/src/ResultsScreen.css
git commit -m "feat(web): hybrid per-profile results"
```

---

### Task 15: Cleanup + full verification

**Files:** Delete `web/src/useAllergens.js`.

- [ ] **Step 1: Confirm no importers of the old hook**

Run: `grep -rn "useAllergens\|AllergenContext\|useAllergenContext" web/src`
Expected: **no matches**. If any remain, fix them (should have been swapped in Tasks 11 & 13).

- [ ] **Step 2: Delete it**
```bash
git rm web/src/useAllergens.js
```

- [ ] **Step 3: Build + server tests**

Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd web && npm run build'` → succeeds.
Run: `bash -lc 'nvm use 20 >/dev/null 2>&1; cd server && npm test'` → all PASS.

- [ ] **Step 4: Full manual regression + accessibility pass**

With both dev servers running:
1. Fresh (migrated) account: existing allergens appear under the default profile; scans behave as before.
2. Add/rename/delete profiles; add custom allergens to a profile.
3. Preset chips set the switches; individual switches toggle; narrowing hides non-active categories in results.
4. Multi-profile scan → hybrid chips + per-profile detail; dismiss persists per profile; History detail reflects current profiles (live rematch).
5. Accessibility: keyboard-only nav through Profiles/editor/results; switches announce on/off; status conveyed as text; run an axe scan (browser devtools extension) on the Profiles and Results screens and fix any AA violations found.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor(web): remove legacy allergens hook; System 2 complete"
```

---

## Self-Review — Spec Coverage

- Per-profile data model (`profiles/{id}` + activeCategories + per-profile allergens/dismissals) → Tasks 9, 10, 5. ✅
- Lazy migration to invisible default profile → Task 9. ✅
- Canonical 11 categories + `categoryKey` on ingredients → Tasks 1, 2. ✅
- Preset definitions + mappings → Task 3 (server), Task 8 (client mirror). ✅
- `activeCategories` matcher filter (personal allergens always; omitted = all) → Task 4. ✅
- Server per-profile matching + `profiles[]` response → Tasks 5, 6. ✅
- Profile-aware `/dismiss` (profileId) + `/rematch` (profiles[]) → Task 7; client api Task 11. ✅
- Profiles card (Home) → Task 13. ✅
- Profiles screen + preset-seeded category editor + per-profile allergens → Task 12. ✅
- Hybrid per-profile results, solo collapses to single verdict → Task 14. ✅
- Add-2nd-profile naming (rename in editor; "Tap to name" surfaced when multi) → Tasks 12 (editor name field + list prompt). ✅
- History summary + live per-profile rematch → Task 11. ✅
- Accessibility (role=switch/aria-checked, aria-selected chips, labels, focus, text-not-color status) → Tasks 12, 14; verified Task 15. ✅
- Scope: billing/scan-limit untouched; sharing/lists/restaurant/photos out of scope → not implemented, correct. ✅

Names are consistent across tasks: `CATEGORIES`/`CATEGORY_KEYS`/`PRESETS`, `categoryKey`, `activeCategories`, `matchAllProfiles`, `getProfiles`, `addDismissedFlag(uid, profileId, ingredientId)`, `ProfileContext`/`useProfileContext`/`useProfiles`, `ensureProfiles`, `dismissFlag(profileId, ingredientId)`, `profiles[]` with `{ profileId, name, flagged, counts }`.

No placeholders remain.
