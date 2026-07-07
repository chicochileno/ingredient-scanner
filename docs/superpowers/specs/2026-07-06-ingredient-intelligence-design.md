# Ingredient Intelligence (Smart Matching + Education) — Design Spec

**Date:** 2026-07-06
**Status:** Approved
**System:** 1 of 4 (Ingredient Intelligence) in the larger feature program — see "Program Context" below.

## Overview

Unify the app's two divergent ingredient matchers into a single, server-side
matching engine that is both **precise** (few false positives) and
**variant-aware** (catches synonyms and word variants). The same engine serves
both the curated inflammatory database and each user's personal allergens.

Adds a soft **"Worth Checking"** tier for uncertain matches, a per-user
**dismiss** mechanism ("Not a concern") so parents can silence wrong flags, and
surfaces **citations** on flags to deliver the "Why is this flagged?" education
payoff.

This spec supersedes the matching architecture in
`2026-06-18-personal-allergens-design.md`: personal-allergen matching moves from
client-side exact-match to the unified server engine, and `web/src/allergenMatcher.js`
is removed.

## Program Context

The user has nine planned features that decompose into four systems plus one
input mode. This spec covers **System 1** only. Build order:

1. **System 1 — Ingredient Intelligence** (this spec): Smart Matching + Education
2. System 2 — Profiles: Multi-Child + Condition Profiles with Presets
3. System 3 — Saved Collections: Safe Snack Lists + Shopping Wishlist + Substitutes
4. System 4 — Sharing: Caregiver Share Mode (link/PDF)
5. Restaurant Mode — menu-text input feeding System 1

Two forward-looking constraints this system must not block:
- Dismiss is user-level now but becomes **per-child** under System 2.
- The curated DB's `category` field is what System 2's presets will filter on.

## The Problem Being Solved

Today there are two matchers that fail in opposite directions:

| Matcher | Location | Failure mode |
|---------|----------|--------------|
| Curated inflammatory DB | `server/utils/ingredientMatcher.js` (substring `includes`) | **False positives** — `"milk"` flags `"coconut milk"`; `"malt"` flags `"maltodextrin"` |
| Personal allergens | `web/src/allergenMatcher.js` (exact match) | **False negatives** — `"onion"` misses `"onion powder"` |

Goal: one engine, precise **and** variant-aware, with a soft tier and a dismiss
escape hatch so the app can lean slightly safe without eroding trust.

## Design Decisions

| Question | Decision |
|----------|----------|
| Where the engine runs | Server-side (Approach 1) — server already has the DB, runs matching, and is authenticated per request |
| Matching precision | Whole-word / phrase boundaries (not substring) |
| Hard precision cases | Per-ingredient `negators` list (e.g. coconut/oat/almond cancel a dairy match) |
| Confidence tiers | `confident` (uses DB severity) and `possible` (soft "Worth Checking") |
| Dismiss scope | **Global per ingredient** (dismiss Red 40 once → quiet everywhere) |
| Negator maintenance | Curated by the team, not exhaustive on day one; dismiss covers gaps |
| Education | Optional `citations` per DB entry, shown as an expandable "Sources" disclosure |
| Personal allergens | Flow through the same engine; tagged `source: 'personal'` |

## Data Model

### A. Extended curated ingredient entries

File: `server/data/inflammatoryIngredients.js`. Three **optional** new fields;
existing entries keep working untouched.

```js
{
  id: 'casein',
  names: ['casein', 'caseinate', 'milk', 'whey', 'lactose', /* ... */],
  category: 'Casein / Dairy',
  severity: 'moderate',
  flag: 'Casein / Dairy Source',
  explanation: '...',

  // NEW — words that, when adjacent to a matched synonym in the same token,
  // cancel the match ("coconut milk" → no dairy flag)
  negators: ['coconut', 'oat', 'almond', 'soy', 'rice', 'cashew', 'hemp'],

  // NEW — synonyms that resolve to the soft "possible" tier rather than confident
  ambiguousNames: ['soy lecithin'],

  // NEW — powers "Why is this flagged? → Sources"
  citations: [
    { title: 'McCann et al., Lancet 2007', url: 'https://...' }
  ],
}
```

### B. New Firestore collection for dismissals

`users/{uid}/dismissedFlags/{ingredientId}`

```js
{
  ingredientId: string,   // curated id ('red40') or personal-allergen doc id
  createdAt: Timestamp
}
```

The document id **is** the ingredient/allergen id, so a dismiss is idempotent and
a lookup is a simple set-membership check.

### C. Personal allergens — unchanged storage

`users/{uid}/allergens/{id}` keeps its current shape (`name`, `type`,
`createdAt`). The server now reads these and feeds them into the unified engine,
so they gain whole-word matching. `type: 'allergy' → 'high'`,
`type: 'sensitivity' → 'moderate'` (unchanged mapping).

## Matching Engine

File: `server/utils/ingredientMatcher.js` (rewritten).

**Signature:**
```js
matchIngredients(rawText, { personalAllergens = [], dismissedIds = new Set() }) → flagged[]
```

**Pipeline:**

1. **Preprocess** — keep existing `stripNonIngredients` (strips "may contain",
   "manufactured in", "gluten-free" descriptor phrases, etc.) and the tokenizer
   that splits on `,;()[]{}` and normalizes.
2. **Build the match set** — curated ingredients + personal allergens. Each
   personal allergen becomes a pseudo-entry: `names: [allergen.name]`, no
   negators, severity from its `type`, `source: 'personal'`, `flag` = the name,
   `explanation: 'Listed in your personal allergens.'`
3. **Whole-word / phrase matching** — a synonym matches a token only at word
   boundaries. `"onion"` matches `"onion powder"` ✓; `"malt"` does **not** match
   `"maltodextrin"` ✗ (mid-word). Multi-word synonyms match as a contiguous
   phrase at word boundaries.
4. **Negator check** — if a matched synonym has a `negator` present as a
   whole word in the same token, **suppress** the match. `"coconut milk"` →
   "milk" matched, "coconut" negator present → no flag. `"goat milk"` → no
   negator → flags (goat milk is dairy).
5. **Tier assignment:**
   - `confident` → normal whole-word match, no negator → severity from DB.
   - `possible` → matched via an `ambiguousNames` synonym → soft "Worth Checking".
6. **Override filter** — drop any flag whose id ∈ `dismissedIds`.
7. **Dedupe** by ingredient id (first match wins); sort high → moderate → possible.

**Returned flag shape (superset of today's):**
```js
{
  id: string,
  flag: string,
  category: string | null,      // null for personal allergens
  severity: 'high' | 'moderate',
  tier: 'confident' | 'possible',   // NEW
  source: 'curated' | 'personal',   // NEW
  explanation: string,
  matchedOn: string,
  citations: [{ title, url }] | undefined,  // NEW, curated only
}
```

**Test case table (drives TDD):**

| Ingredient text | Synonym | Expected |
|-----------------|---------|----------|
| `onion powder` | onion (personal) | flag, confident |
| `coconut milk` | milk (casein) | no flag (negator) |
| `oat milk` | milk (casein) | no flag (negator) |
| `goat milk` | milk (casein) | flag, confident |
| `maltodextrin` | malt (gluten) | no flag (mid-word) |
| `FD&C Red No. 40` | red 40 | flag, confident |
| `soy lecithin` | soy lecithin (ambiguous) | flag, possible |
| dismissed `red40` present | red 40 | no flag (override) |

## API & Scan Flow

File: `server/routes/scan.js`. All three routes already run `matchIngredients`
and have `req.uid`.

- Before matching, each route reads (Admin SDK):
  - `users/{uid}/allergens` → `personalAllergens`
  - `users/{uid}/dismissedFlags` → `dismissedIds` (Set of doc ids)
- Pass both into `matchIngredients(text, { personalAllergens, dismissedIds })`.
- Response shape unchanged except each `flagged` item carries the new fields.
- **Two extra Firestore reads per scan** — acceptable; caching deferred.

**New endpoint — dismiss:**
```
POST /scan/dismiss   { ingredientId }   (requireAuth)
```
Writes `users/{uid}/dismissedFlags/{ingredientId}`. Routed through the server
(rather than a direct client write) to keep matching-related writes in one place
and validate the id.

## UI Changes

File: `web/src/ResultsScreen.jsx` (+ CSS). Delete `web/src/allergenMatcher.js`
and the `matchAllergens` call — flags now arrive pre-computed and pre-filtered.

- **Three sections**, driven by `source` / `tier`:
  1. **Personal Allergens** — `source: 'personal'`
  2. **Flagged Ingredients** — `source: 'curated'`, `tier: 'confident'`
  3. **Worth Checking** — `tier: 'possible'` (NEW; muted color, softer icon,
     visibly less alarming than high/moderate)
- **"Not a concern" action** on each card → `POST /scan/dismiss`, optimistically
  hide the card. Persisted, so it will not reappear on future scans.
- **"Sources" disclosure** — when a flag has `citations`, render a small
  expandable list of linked studies beneath the explanation. This is the visible
  Education payoff.
- Banner counts operate on the merged, filtered list (existing logic).
- **Backward compatibility:** flags from previously-stored history scans lack
  `tier` / `source`. `ResultsScreen` defaults missing `tier` → `'confident'` and
  missing `source` → `'curated'`, so old scans render in the "Flagged
  Ingredients" section exactly as before.

## Data Flow

Scan request (authenticated)
  → server route reads `allergens` + `dismissedFlags` from Firestore
  → `matchIngredients(text, { personalAllergens, dismissedIds })`
  → tiered, filtered `flagged[]` in response
  → `ResultsScreen` renders three sections by `source`/`tier`
  → "Not a concern" → `POST /scan/dismiss` → future scans exclude it

History screens re-render from stored `rawText`; because matching is now
server-side, a re-fetch reflects current allergens/dismissals. (History
re-evaluation parity is verified in testing; if history stores server `flagged`
snapshots, those remain as-scanned — acceptable.)

## Testing

- **Unit tests** for `matchIngredients` — the case table above plus dedupe,
  tier, and override cases. Pure and fast; written first (TDD).
- **Integration check** on one scan route: personal allergens + dismissed flags
  are read and applied.
- **Manual pass** on real products: one dairy item, one with dyes, one
  coconut-milk red herring, and one personal-allergen variant ("onion powder").

## What Does Not Change

- OCR / Vision / Open Food Facts flow — untouched.
- Curated DB entries without new fields — behave as before (minus substring
  false positives that the whole-word change intentionally removes).
- Personal allergens storage schema and the "My Allergens" screen.
- Billing / scan-limit logic.

## Out of Scope (deferred to later systems)

- Per-child dismiss and per-child profiles (System 2).
- Condition Profile presets filtering by `category` (System 2).
- Restaurant Mode prose matching (needs a prose-aware tokenizer; System 1's
  comma-based tokenizer is retained for now).
- Caching the per-scan Firestore reads.
- Editing/undoing a dismiss from a settings screen (dismiss is one-way for now;
  revisit if users need it).
