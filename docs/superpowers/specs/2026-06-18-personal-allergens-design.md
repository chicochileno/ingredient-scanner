# Personal Allergens & Sensitivities — Design Spec

**Date:** 2026-06-18
**Status:** Approved

## Overview

Users can maintain a personal list of ingredients they are allergic to or sensitive to. These are flagged in every scan alongside the existing inflammatory ingredient detection. The default inflammatory flagging behavior is unchanged — allergen flags are additive.

## Design Decisions

| Question | Decision |
|----------|----------|
| Entry point | Third card on home screen ("My Allergens") |
| Storage | Firestore (`users/{uid}/allergens/{id}`) |
| Matching | Client-side, exact name match |
| History | Re-evaluated live against current allergen list |
| Results layout | Separate sections: Personal Allergens + Inflammatory |
| Architecture | Client-side allergen matching; server untouched |

## Data Model

Firestore collection: `users/{uid}/allergens/{allergenId}`

```js
{
  name: string,        // e.g. "onion" — lowercase, user-entered
  type: 'allergy' | 'sensitivity',
  createdAt: Timestamp
}
```

Severity mapping:
- `allergy` → `'high'` (High concern)
- `sensitivity` → `'moderate'` (Moderate concern)

## Matching Logic

**File:** `web/src/allergenMatcher.js`

**Input:** `rawText` (OCR or ingredient string), `allergens[]` (from Firestore)

**Algorithm:**
1. Parse `rawText` into individual ingredients by splitting on commas, respecting nested parentheses (e.g. `"sugar (cane sugar), onion, natural flavor"` → `["sugar (cane sugar)", "onion", "natural flavor"]`)
2. Normalize each ingredient: lowercase, trim whitespace
3. For each user allergen, normalize the name the same way and check for an exact match against any parsed ingredient
4. Exact match only — `"onion"` matches `"onion"` but not `"onion powder"` or `"organic onion"`

**Returns:** Array of flagged items in the same shape as the server response:
```js
{
  id: string,          // allergen Firestore doc ID
  flag: string,        // allergen name (display)
  severity: 'high' | 'moderate',
  explanation: "Listed in your personal allergens.",
  matchedOn: string    // the parsed ingredient string that matched
}
```

**Edge cases:**
- If `allergens` is empty, returns `[]` — no change to results
- Duplicate matches (same allergen matching multiple ingredients) are deduplicated by allergen id
- Case-insensitive: user entering "Onion" matches ingredient "onion"

## Components

### New: `web/src/useAllergens.js`
Custom hook. Reads/writes allergens from Firestore for the current user.

```js
const { allergens, addAllergen, removeAllergen, loading } = useAllergens(user);
```

- Loads once on mount, stays in sync via `onSnapshot`
- `addAllergen({ name, type })` → writes to Firestore
- `removeAllergen(id)` → deletes from Firestore

### New: `web/src/allergenMatcher.js`
Pure function — no React, no side effects.

```js
matchAllergens(rawText, allergens) → flaggedAllergens[]
```

### New: `web/src/AllergensScreen.jsx` + `AllergensScreen.css`
Route: `/allergens`

- Header with back button
- Helper text: *"Exact names only — 'onion' won't match 'onion powder'."*
- List of saved allergens; each row shows name, type badge (red = allergy, amber = sensitivity), × delete button
- Floating green + button (bottom-right, 52×52px, 44px minimum touch target met)
- Add sheet (bottom sheet): text input + Allergy/Sensitivity toggle + Save button
- Empty state when no allergens saved: simple prompt to add your first item

### New: `web/src/AllergenAddSheet.jsx`
Bottom sheet triggered by + button on AllergensScreen.

- Text input: ingredient name (trimmed, lowercased before save)
- Toggle: Allergy (red) / Sensitivity (amber) — Allergy selected by default
- Save button (disabled until name is non-empty)
- Dismiss on backdrop tap or after save

## App Changes

### `web/src/App.jsx`
- Add `/allergens` route (auth-required)
- Call `useAllergens(user)` at app level; expose result via `AllergenContext` (React context) so any screen can consume it without prop-drilling through route components
- Navigate to `/allergens` from home screen

### `web/src/HomeScreen.jsx`
- Add third card: "My Allergens" with a shield/warning icon
- Shows count badge ("3 items") when allergens exist, "None set" when empty
- Receives `onAllergens` callback prop → navigates to `/allergens`

### `web/src/ResultsScreen.jsx`
- Consume `allergens` from `AllergenContext` (no new prop needed)
- On render, run `matchAllergens(rawText, allergens)` to get `allergenFlags`
- Render two sections when `allergenFlags.length > 0`:
  1. **Personal Allergens** — red section label, allergenFlags sorted high → moderate
  2. **Flagged Ingredients** — existing inflammatory section (label unchanged)
- When `allergenFlags` is empty, render existing single section only — zero UI change for users with no allergens set

## Data Flow

```
App.jsx
  └─ useAllergens(user) → allergens[]
       │
       └─ AllergenContext.Provider value={allergens}
              │
              ├─ HomeScreen — useContext(AllergenContext) for count badge
              │
              └─ ResultsScreen — useContext(AllergenContext) + rawText
                     │
                     └─ matchAllergens(rawText, allergens)
                           → allergenFlags[]  (display only, never saved to Firestore)
```

Scan documents saved to Firestore contain only server-returned data (`rawText`, `flagged` inflammatory items). Allergen flags are always computed fresh client-side so history automatically reflects the user's current allergen list.

## History Re-evaluation

No extra work required. `HistoryScanRoute` in `App.jsx` already passes the saved `rawText` to `ResultsScreen`. Since `allergens` flows from app-level state and `matchAllergens` runs on every render, every history scan view automatically reflects the current allergen list.

## What Does Not Change

- Server code (`server/`) — no modifications
- Inflammatory ingredient matching — runs exactly as before
- Scan storage schema — no new fields
- Behavior for users with no allergens saved — identical to current

## Out of Scope

- Autocomplete or suggestions when typing allergen names
- Editing an allergen name after saving (delete + re-add)
- Sharing allergen profiles between users
