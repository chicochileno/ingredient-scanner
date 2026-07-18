# Sharing — Caregiver Share (System 4) — Design Spec

**Date:** 2026-07-17
**Status:** Approved
**System:** 4 of 4 in the Ingredient Intelligence program. Builds on System 2
(profiles) and System 3 (lists).

## Overview

Let a parent share a **profile** (a child's "what to avoid" summary) or a **list**
(a child's approved/safe snacks) via a **public, unguessable, revocable link** —
so caregivers who don't have the app (school staff, grandparents, sitters, ABA
therapists) can open a clean, printable page in any browser. Shares are **live**
(always reflect the latest data) and resolved through a public backend endpoint,
so **nothing private is ever exposed in Firestore**. Print → Save-as-PDF gives
the "PDF" with no PDF library.

## Program Context

Build order:
1. System 1 — Ingredient Intelligence (shipped)
2. System 2 — Profiles & Condition Presets (shipped)
3. System 3 — Saved Collections (shipped)
4. **System 4 — Sharing** (this spec)
5. Restaurant Mode; System 3b — Substitutes (both later)

Prior decision honored: profiles and lists were designed as self-contained
snapshot-able units so sharing wouldn't require restructuring.

## Design Decisions

| Question | Decision |
|----------|----------|
| Audience / mechanism | **Public read-only link** (recipient needs no account) + printable page. Account-to-account sharing **deferred**. |
| Freshness | **Live** — resolved on each view via a public backend endpoint reading current data (not a frozen snapshot). |
| What can be shared | **Both** profiles and lists (one pipeline). |
| Profile share content | Child name + "avoid" list = active-category labels + custom allergen names. |
| List share content | **Profile-scoped**: "Safe snacks for [Child] — [list name]", each item tagged safe / flagged / not-scanned **for that child**. Sharer picks the child (auto if only one profile). |
| Privacy | Firestore stays owner-locked; the public endpoint returns a **curated projection only** (never scans, uids, other profiles, or account data). |
| Revocation | `revoked` flag on the share → endpoint 404s immediately; owner UI "Stop sharing". |
| PDF | Browser Print / Save-as-PDF on the styled public page (no PDF library). |
| Rate limiting | Lightweight per-IP limiter on the public endpoint (first public endpoint). |
| Accessibility | WCAG 2.1 AA on the public page and share UI. |

## Data Model

**Top-level share record**, keyed by an unguessable token (the doc id is the token):
```
shares/{shareId}
  {
    ownerUid: string,
    type: 'profile' | 'list',
    refId: string,            // profileId (type=profile) or listId (type=list)
    profileId: string | null, // list shares only: the child the list is "safe for"
    revoked: boolean,
    createdAt: Timestamp
  }
```
- The shared profile/list doc also gets a **`shareId`** field (so the owner UI knows it's shared and can show/revoke the link without querying the `shares` collection).
- **Direct-doc lookup** (`shares.doc(shareId)`) — no collection-group query, so **no manual Firestore index** required.

## Token

`shareId` = 24 URL-safe random chars from `crypto.getRandomValues` (client-side).
Format validated server-side against `/^[A-Za-z0-9_-]{16,64}$/` before any lookup.

## Server

### New file `server/routes/share.js` (mounted at `/share`, NO auth)

`GET /share/:shareId`:
1. Validate token format → 400 if malformed.
2. Apply the per-IP rate limiter (below) → 429 if exceeded.
3. `shares.doc(shareId).get()` via Admin SDK → 404 if missing or `revoked`.
4. Resolve current data via Admin SDK:
   - **profile:** read `users/{ownerUid}/profiles/{refId}` + its `allergens` → `buildProfileShare`.
   - **list:** read `users/{ownerUid}/lists/{refId}/items` + the chosen profile
     (`profiles/{profileId}` + allergens/dismissed) → `buildListShare` (runs the
     matcher per scanned item against that profile).
5. Return the curated projection JSON. Never include uids, scans, or other profiles.

### Pure projection builders (in `server/utils/shareData.js`, unit-tested)

```js
// activeCategories -> plain labels (via categories.js) + custom allergen names
buildProfileShare(profile, allergens) -> {
  type: 'profile', title: <name or 'Food profile'>, avoid: [<label>, ...]
}

// items + one profile's match data -> per-item status for that child
buildListShare(listName, childName, items, profileFlagInputs) -> {
  type: 'list', title: listName, childName,
  items: [ { name, status: 'safe' | 'flagged' | 'unscanned' } ]
}
```
`buildListShare` uses `matchIngredients(item.rawText, { activeCategories, personalAllergens, dismissedIds })` for scanned items (`status = flagged.length ? 'flagged' : 'safe'`); manual items → `'unscanned'`.

### Rate limiter

A small in-memory fixed-window per-IP limiter (e.g., 60 requests / minute / IP)
in `server/middleware/rateLimit.js`, applied only to the public `/share` route.
(No new dependency; in-memory is fine for a single instance.)

## Client

### Owner side

- **`web/src/api.js`:** `fetchShare(shareId)` is NOT needed (public page calls the
  API directly with fetch, no auth token). Add nothing here for the owner; sharing
  writes go through Firestore directly (like other profile/list writes) in a hook.
- **`web/src/useShare.js`:** `createShare(type, refId, profileId?)` (generate token,
  write `shares/{token}`, set `shareId` on the profile/list), `revokeShare(type, refId, shareId)` (set `revoked`, clear `shareId`). Builds the public URL.
- **`web/src/ShareSheet.jsx`:** given `{ type, refId, existingShareId, needsProfile }`:
  - list share with >1 profile → first pick the child.
  - not shared → "Create link" → shows URL + **Copy** + native **Share**
    (`navigator.share`) + "Anyone with this link can view it."
  - shared → shows URL + **Stop sharing** (revoke).
  - a "Preview" link opens the public page in a new tab.
- **Entry points:** a "Share" button in `ProfileEditor.jsx` and in `ListDetailScreen`.

### Public page (outside the auth gate)

- **`web/src/SharePage.jsx`**, route `/s/:shareId` added in `App.jsx` **outside**
  `RequireAuth`, and excluded from the catch-all login redirect.
- Fetches `GET {VITE_API_URL}/share/:shareId`, renders a clean printable document:
  app name, title, the avoid-list (profile) or item list with statuses (list),
  a short caregiver intro, the informational-only disclaimer, and a
  **Print / Save as PDF** button (`window.print()` + print CSS).
- States: loading, loaded, and **not-available** (404/revoked → friendly message).
- Design-system styled (sage/cream, Bricolage headings), print-optimized, WCAG AA
  (status as text, not color alone).

## Firestore Rules

Add (owner-managed; public reads happen server-side via Admin SDK, not via rules):
```
match /shares/{shareId} {
  allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerUid;
}
```
⚠️ **Deploy gotcha:** CI does not deploy rules — **manually publish** at deploy or
share create/revoke fails. No manual index required.

## Testing

- **Server (unit, `node --test`):** `buildProfileShare` (active categories → labels
  + allergens; empty cases), `buildListShare` (scanned safe vs flagged for the
  profile; manual → unscanned; empty list), and the token validator. Endpoint I/O
  + rate limiter are manual/integration-verified.
- **Client (manual):** create a profile share → open the link in a **private
  window (no login)** → correct avoid-list → Print. Share a list "for Emma" →
  correct per-item statuses + child name. Revoke → link shows "no longer
  available". Accessibility pass on the public page.

## What Does Not Change

- System 1–3 internals (matching, profiles, lists) — sharing only reads them.
- Billing / scan-limit / Stripe. Sharing is free and consumes no scans.
- OCR / Vision / Open Food Facts flow.

## Out of Scope (later / YAGNI)

- Account-to-account (collaborative) sharing.
- Auto-expiring links (revoke-only for now).
- Recipient editing; view analytics; QR codes.
- A real PDF-generation library (browser print suffices).
