# Profiles & Condition Presets (System 2) — Design Spec

**Date:** 2026-07-10
**Status:** Approved
**System:** 2 of 4 in the Ingredient Intelligence program. Builds on System 1
(`2026-07-06-ingredient-intelligence-design.md`, shipped).

## Overview

Introduce **multiple per-person profiles** and **condition presets**. Today the
app has one allergen list per account and applies the entire curated
inflammatory database to everyone. This system makes "who" a first-class
concept: each profile chooses **which curated categories** apply to it (via
one-tap condition presets that a parent can fine-tune) plus its own custom
allergens. A single scan is evaluated against every profile at once and shows a
per-profile verdict.

Profiles are **people, not just children** — a profile can be a child, a parent,
or anyone. Multiple profiles are **free** (not gated behind the subscription).

## Program Context

Build order (this is System 2):
1. System 1 — Ingredient Intelligence (shipped)
2. **System 2 — Profiles & Condition Presets** (this spec)
3. System 3 — Saved Collections
4. System 4 — Sharing (will share a profile)
5. Restaurant Mode

Forward constraints honored here:
- Dismiss (user-level in System 1) becomes **per-profile** now.
- The curated DB's category is promoted to a stable `categoryKey` that presets
  and profiles reference.

## Design Decisions

| Question | Decision |
|----------|----------|
| Results model | **Hybrid**: one scan → per-profile summary chips → tap to expand a profile's flags. Collapses to today's single verdict for a solo (1-profile) user. |
| What a preset controls | Presets **narrow** what's flagged (opt-in categories per profile), with a **safe default** (new profile = "Autism/ASD" = all categories on). |
| Editor model | Preset chips **seed editable category switches**; switches are the source of truth; custom allergens added separately. |
| Multi-profile gating | **Free**, unlimited. No paywall changes. Called out as a marketing selling point later. |
| Solo-user experience | The profile concept is **invisible** until a 2nd profile is added (auto default profile, `name: null`, results look like today). |
| Concept scope | **Profiles = people** (child, parent, anyone). No child/adult type field. |
| Custom allergens | **Per-profile** (no shared household list — YAGNI). |
| Matching location | **Server-side, per profile** (consistent with System 1's single engine). |
| History | Store `rawText` + compact summary; detail view re-evaluates live via `/scan/rematch`. |
| Accessibility | **WCAG 2.1 AA** throughout (see Accessibility section). |

## Data Model

### Profiles

`users/{uid}/profiles/{profileId}`
```js
{
  name: string | null,        // null = invisible default (solo user); named once a 2nd profile is added
  activeCategories: string[], // canonical categoryKeys currently "on" (source of truth)
  order: number,              // display order
  createdAt: Timestamp
}
```

### Per-profile allergens and dismissals

`users/{uid}/profiles/{profileId}/allergens/{id}`
```js
{ name: string, type: 'allergy' | 'sensitivity', createdAt: Timestamp }
```
`users/{uid}/profiles/{profileId}/dismissedFlags/{ingredientId}`
```js
{ ingredientId: string, createdAt: Timestamp }
```

### Migration (lazy, once per existing user, on first load)

Pure decision logic (unit-testable) drives a client-side Firestore write:
1. If `users/{uid}/profiles` is empty, create one default profile:
   `{ name: null, activeCategories: <all 11 keys>, order: 0, createdAt }`.
2. Move existing `users/{uid}/allergens/*` → default profile's `allergens`.
3. Move existing user-level `users/{uid}/dismissedFlags/*` → default profile's
   `dismissedFlags`.

Result: every current user's experience is unchanged after upgrade (same flags,
same allergens), now housed in an invisible default profile.

## Canonical Categories

Add a stable `categoryKey` to each curated ingredient in
`server/data/inflammatoryIngredients.js` (alongside the existing display
`category`). The 11 canonical keys:

| categoryKey | Label | Curated ids |
|---|---|---|
| `dyes` | Artificial Dyes | red40, yellow5, yellow6, blue1, blue2, red3, green3 |
| `preservatives` | Preservatives | bha, bht, tbhq, sodiumbenzoate, sodiumnitrate |
| `excitotoxins` | MSG & Excitotoxins | msg, aspartame, naturalflavors |
| `sweeteners` | Artificial Sweeteners | sucralose, acesulfamek, saccharin |
| `hfcs` | Added Sugars / HFCS | hfcs |
| `gluten` | Gluten | gluten |
| `dairy` | Dairy / Casein | casein |
| `soy` | Soy | soy |
| `artificial-flavors` | Artificial Flavors | artificialflavors |
| `carrageenan` | Carrageenan | carrageenan |
| `aluminum` | Aluminum Additives | aluminum |

A single source-of-truth module (`server/data/categories.js`) exports the
canonical key list + display labels, used by the matcher and presets. The
**profile editor UI uses a mirrored client constant** (`web/src/profileCatalog.js`)
holding the same categoryKeys + labels + preset definitions — static data, so a
mirror avoids an API round-trip. The **categoryKeys are the contract** between
the two; the server-side `categoryKey`→ingredient mapping is authoritative for
matching. (A future GET /catalog endpoint could replace the mirror if drift ever
becomes a concern; not needed now.)

## Preset Definitions

`server/data/presets.js` — pure data, unit-tested:
```js
{
  'autism':      <all 11 keys>,
  'feingold':    ['dyes', 'artificial-flavors', 'preservatives'],
  'gfcf':        ['gluten', 'dairy'],
  'dairy-free':  ['dairy'],
  'no-dyes':     ['dyes'],
}
```
Each preset also carries a display label and short description for the chips.
Tapping a preset chip sets the profile's `activeCategories` to that key set (the
parent may then toggle individual categories).

## Matching Engine Changes

`server/utils/ingredientMatcher.js` — add one option to `matchIngredients`:
```js
matchIngredients(rawText, { activeCategories, personalAllergens, dismissedIds })
```
- **`activeCategories: string[]`** — a curated ingredient flags only if its
  `categoryKey` ∈ `activeCategories`. If `activeCategories` is omitted
  (undefined), behave as System 1 (all curated flag) for backward compatibility.
- **Custom (personal) allergens always flag**, regardless of `activeCategories`.
- Everything else (whole-word matching, negators, tiers, dismiss filter) is
  unchanged.

## API & Scan Flow

`server/utils/userMatchData.js` — new helpers:
- `getProfiles(uid)` → array of `{ id, name, activeCategories, order }` sorted by
  order.
- `getProfileMatchData(uid, profileId)` → `{ activeCategories, personalAllergens, dismissedIds }`.
- `addDismissedFlag(uid, profileId, ingredientId)` (now profile-scoped).

`server/routes/scan.js` — every scan route builds a **per-profile** result:
```js
const profiles = await getProfiles(uid);
const perProfile = await Promise.all(profiles.map(async (p) => {
  const data = await getProfileMatchData(uid, p.id);
  const flagged = matchIngredients(rawText, data);
  return {
    profileId: p.id,
    name: p.name,
    flagged,
    counts: countByTier(flagged),
  };
}));
```
Response shape (all scan routes):
```js
{
  productName, rawText,
  profiles: [ { profileId, name, flagged: [...], counts: { high, moderate, possible } } ]
}
```
Each `flagged` item keeps System 1's shape (`id, flag, category, severity, tier,
source, explanation, matchedOn, citations?`) so `ResultsScreen`'s card renders
unchanged.

**Profile-aware endpoints:**
- `POST /scan/dismiss` → body `{ profileId, ingredientId }`. Validates both
  (`ingredientId` keeps System 1's `/^[a-zA-Z0-9_-]{1,128}$/` guard; `profileId`
  validated as a Firestore id).
- `POST /scan/rematch` → returns the same `{ profiles: [...] }` shape.

**Scan storage** (`App.jsx` `handleResult`): save `rawText`, `productName`, and a
compact `summary` `{ flaggedProfileCount, totalProfiles }` for History list
badges. History **detail** re-evaluates live via `/scan/rematch`.

**Billing/scan limits:** unchanged. One scan = one scan regardless of profile
count.

## UI

- **Home screen** (`HomeScreen.jsx`): the "My Allergens" card becomes a
  **"Profiles"** card. Solo user → shows the default profile's summary (e.g.
  "Autism · 3 custom allergens"), visually ~identical to today. Multi → shows
  profile names ("Emma, Liam, +1").
- **Profiles screen** (evolves from `AllergensScreen.jsx`): list of profile rows
  (name + summary), each tappable into the editor; an **"Add profile"** button.
- **Profile editor**: preset chips (seed switches) → category switches
  (editable) → custom allergens (reuses the existing add-sheet).
- **Results** (`ResultsScreen.jsx`): per-profile summary chips, tap to expand a
  profile's flagged cards (System 1 cards reused). Solo → single verdict.
- **Add-2nd-profile flow**: when a solo user adds a second profile, prompt to
  name **both** the new profile and the previously-unnamed default. After that,
  names/chips appear throughout.

## Accessibility (WCAG 2.1 AA)

- Safe/flagged status conveyed by **text + shape, never color/emoji alone** —
  chips read "Emma — safe" / "Liam — 2 flagged".
- Category switches: `role="switch"`, `aria-checked`, keyboard-operable, visible
  focus ring.
- Preset chips: buttons with `aria-pressed`. Add-sheet inputs have associated
  `<label>`s.
- Color contrast ≥ 4.5:1 on tier/status colors.
- Results chips and profile rows reachable and operable by keyboard.

## Testing

**Server (unit, extends System 1 `node --test` suite):**
- `activeCategories` filter: inactive category ⇒ curated not flagged; active ⇒
  flagged; personal allergens flag regardless; empty `activeCategories` ⇒ only
  personal allergens; omitted `activeCategories` ⇒ all curated (back-compat).
- Data integrity: every curated ingredient has a valid `categoryKey` from the
  canonical 11.
- Preset definitions: each preset maps to the expected keys.
- Migration and preset→categories logic extracted into pure, unit-tested
  functions.

**Client (manual, no harness):** profile CRUD, add-2nd-profile naming flow,
multi-profile scan → hybrid results, History detail live rematch, and an
accessibility pass (keyboard-only nav + screen-reader status announcement +
automated axe scan of profile/results screens).

## What Does Not Change

- System 1 matching internals (whole-word, negators, tiers, citations, dismiss
  mechanics) — only the `activeCategories` filter is added.
- OCR / Vision / Open Food Facts flow.
- Billing / scan-limit / Stripe.

## Out of Scope (later systems / YAGNI)

- Sharing a profile (Caregiver Share = System 4).
- Saved collections (System 3), Restaurant Mode.
- Shared household allergen list (per-profile only).
- Profile photos / avatars / colors.
- Reordering profiles by drag (simple `order` field only; UI reorder can come
  later).
