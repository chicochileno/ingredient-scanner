# Saved Collections (System 3) — Design Spec

**Date:** 2026-07-13
**Status:** Approved
**System:** 3 of 4 in the Ingredient Intelligence program. Builds on System 1
(matching) and System 2 (profiles). Substitutes are split out (see Scope).

## Overview

Let users save scanned products (and manual items) into named **Lists** — a
unified feature covering both the "Safe Snacks" pantry use and the "Scan Before
You Shop" wishlist use. Lists are family-level; each scanned item shows its
**live per-profile** safe/flagged status (reusing System 2's per-profile
matching). Items can be checked off (shopping) and filtered by safety. This turns
the app from a scanner into a pantry/shopping manager — a retention play.

## Program Context

Build order:
1. System 1 — Ingredient Intelligence (shipped)
2. System 2 — Profiles & Condition Presets (shipped)
3. **System 3 — Saved Collections** (this spec)
4. System 4 — Sharing (will make lists shareable)
5. Restaurant Mode
- **System 3b — Substitute Suggestions** — deferred to its own effort. It needs
  a product catalog (likely Open Food Facts + the existing matcher as the "safe"
  filter) and carries recommendation/liability weight, so it is out of scope here.

Forward constraint honored: a list + its items is a **self-contained snapshot**
unit, so System 4 can expose it as a read-only link/PDF (or collaborative share)
without restructuring. System 4 will decide public-link/PDF vs. account-to-account
sharing.

## Design Decisions

| Question | Decision |
|----------|----------|
| Lists ↔ profiles | **Family-level lists**; per-profile safe/flagged shown per scanned item (reuses System 2 chips). |
| Lists vs. Wishlist | **Unified**: one Lists feature; items are checkable (shopping) and filterable by safety (pantry). |
| Item kinds | **Scanned** (carries `rawText` → live status) and **manual** (freeform text, neutral "not scanned"). |
| Status freshness | **Live** — recomputed per-profile on list open via batch rematch; never stored (stays correct as profiles change). |
| Item storage | **Self-contained snapshot** (name/rawText/image/upc copied in), not a reference to a `scans/` doc — deleting a scan never breaks a list. |
| Sharing | **Out of scope** (System 4). Data model is share-ready. |
| List performance | New `POST /scan/rematch-batch` endpoint: fetch profile data once, match all item texts in one round trip. |
| Home layout | **Scan** becomes the large primary card; **History / Profiles / Lists** become three smaller cards in a row below it. |
| Accessibility | WCAG 2.1 AA throughout. |

## Data Model

```
users/{uid}/lists/{listId}
  { name: string, order: number, createdAt: Timestamp }

users/{uid}/lists/{listId}/items/{itemId}
  // scanned item:
  { kind: 'scanned', name: string, rawText: string,
    imageUrl: string | null, upc: string | null,
    checked: boolean, addedAt: Timestamp }
  // manual item:
  { kind: 'manual', name: string, checked: boolean, addedAt: Timestamp }
```

- **Family-level** lists (no profile ownership). Scanned items' safe/flagged is
  computed live per-profile on view; manual items are neutral.
- `checked` supports the shopping/wishlist use.
- `kind` is explicit so the UI renders the two item types cleanly.

### Firestore rules

Add an owner-scoped recursive rule (same pattern as `profiles`):
```
match /users/{userId}/lists/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```
⚠️ **Deploy gotcha:** CI does not deploy Firestore rules — this must be
**manually published** in the Firebase Console at deploy time, or client list
operations fail with permission-denied. (Billing stays client-write-protected;
this rule does not touch it.)

## Server: batch rematch

**File:** `server/routes/scan.js` + a pure helper (testable) in
`server/utils/userMatchData.js`.

- Extract a pure function:
  `matchTextsForProfiles(profiles, profileInputsById, items)` → for each
  `{ itemId, rawText }`, returns `{ itemId, profiles: [{ profileId, name, flagged, counts }] }`,
  reusing `matchIngredients` with each profile's `activeCategories` + inputs.
- New endpoint `POST /scan/rematch-batch` (requireAuth, does NOT consume a scan):
  - Body: `{ items: [{ itemId, rawText }] }` (cap array length, e.g. ≤ 200; cap
    each `rawText` at 20000 like `/rematch`).
  - Fetches the user's profiles + each profile's allergen/dismissed inputs
    **once**, then matches all item texts.
  - Returns `{ results: [{ itemId, profiles: [...] }] }`.
- Manual items are not sent to this endpoint (no `rawText`).

## Save & Manage Flows

- **Save a scanned product:** a "Save to list" action on the **Results screen**
  and on a **History** item. Opens a sheet to pick an existing list or create a
  new one; snapshots the product (name, rawText, imageUrl, upc) as a `scanned`
  item. A product may be saved to multiple lists.
- **Add a manual item:** inside a list, "+ Add item" → text → `manual` item.
- **Check off** items (toggles `checked`).
- **Filter within a list:** **All / Safe / Has flags**. *Safe* = safe for **all**
  profiles; *Has flags* = flagged for **≥1** profile (solo family → simply
  safe vs. flagged). Manual items group separately under "not scanned" and are
  unaffected by the filter.
- **CRUD:** rename/delete list, remove item. `order` field for list ordering
  (drag-reorder deferred).

## UI

- **Home screen** (`HomeScreen.jsx` + CSS): **Scan** becomes the large primary
  card (prominent, full-width hero). **History, Profiles, Lists** become three
  smaller cards in a single row beneath it.
- **Lists screen** (`/lists`, new `ListsScreen.jsx`): the user's lists (name +
  item count), a "+ New list" button, empty state.
- **List detail** (`/lists/:listId`, new `ListDetailScreen.jsx`):
  - Editable list name + back; the All / Safe / Has-flags filter control.
  - **Scanned rows:** thumbnail + name + **compact per-profile status text**
    ("Safe for all" / "Flagged for Liam") + checkbox; tapping the row opens the
    full per-profile detail (reuses the Results view via rematch).
  - **Manual rows:** name + checkbox + "not scanned" tag, grouped separately.
  - "+ Add item" (manual).
- **Save-to-list sheet** (`SaveToListSheet.jsx`): from Results/History — choose
  an existing list or create one.
- **Client hooks:** `useLists(user)` (+ `ListContext`) for list CRUD and item
  add/remove/check, mirroring the `useProfiles` pattern; a `rematchBatch(items)`
  call in `api.js`.

### Accessibility (WCAG 2.1 AA)

- Checkboxes use native `<input type="checkbox">` or `role="checkbox"` +
  `aria-checked`, keyboard-operable, visible focus.
- Safe/flagged status conveyed as **text**, never color/emoji alone.
- The All/Safe/Has-flags filter is an accessible control group (`aria-pressed`
  buttons), keyboard-operable.
- List rows, "Save to list" items, and sheet controls have labels + visible
  focus; the save/add sheets are `role="dialog" aria-modal="true"` with labeled
  inputs.

## Testing

- **Server (unit, `node --test`):** `matchTextsForProfiles` — correct per-item,
  per-profile results; blank/empty rawText yields empty flags; ordering by item;
  reuses matcher behavior. Endpoint I/O manual-verified.
- **Client (manual, no harness):** list CRUD; save-to-list from Results +
  History; manual add; check-off; All/Safe/Has-flags filter; per-profile status
  correctness on a multi-profile account; new Home layout (large Scan + 3-across
  row); accessibility pass (keyboard + axe on Lists screens).

## What Does Not Change

- System 1 matching internals and System 2 profiles/presets.
- Scan / OCR / Vision / Open Food Facts flow.
- Billing / scan-limit / Stripe. (Lists and rematch-batch do not consume scans.)

## Out of Scope (later / YAGNI)

- Sharing lists (System 4).
- Substitute Suggestions (System 3b).
- Drag-reorder of lists/items.
- Upgrading a manual item into a scanned item by scanning it.
- UPC-based dedup across lists (each save is an independent snapshot).
