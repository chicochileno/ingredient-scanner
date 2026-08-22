# UI Redesign — Sub-project 3, Batch C: History, Support & Upgrade — Design Spec

**Date:** 2026-08-22
**Status:** Approved
**Builds on:** Batch A's `patterns.css` (`.ui-card/.ui-pill/.ui-btn/.ui-section-title/.ui-preview/.ui-input`), `homeModel` (`scanCardModel`, `scanModeBadge`), and the design tokens.

## Overview

Restyle **HistoryScreen, SupportScreen, and UpgradeScreen** onto the shared `.ui-*` patterns and tokens. History keeps its list layout but rows become cards with **mode badges** + `.ui-pill` status (option B). Two small feature/consistency additions requested by the owner: (1) **rename & delete a scan from its detail page** (not just the History list), and (2) make the **"add to list" icon match the Lists nav icon** (bullet list, replacing the bookmark). Mostly visual; one shared rename/delete helper is introduced to avoid duplicating logic.

## Program Context

SP3 Batch C (after A — scan output, B — profiles & lists). Reuses the Batch A/B foundation. Remaining: Batch D (Login/Legal/gate). The deferred OFF-photo bug is still separate.

## Design Decisions

| Question | Decision |
|----------|----------|
| History layout | **Option B:** stays a list; rows → `.ui-card`. |
| History thumbnails | Contained on the dark-gray `--preview-bg` + a **mode badge** (`scanModeBadge`: barcode/label/menu). Row-sized (not the full 180px). |
| History status badge | The custom "Clear/count" `FlagBadge` → the `.ui-pill` **safe/flagged** system via `scanCardModel(scan).status/label`. |
| Add-to-list icon | Replace the **bookmark** icon with the **bullet-list icon** (exact path from the Lists nav tab) on the History save-to-list button, so it matches the Lists icon. |
| Rename/delete on detail | `ResultsScreen`, when showing a saved history scan, gets an **inline name edit** (pencil → input + save/cancel) and a **"Delete scan"** danger button (bottom). Only in history context; fresh scans don't show them. |
| Shared logic | Extract rename + delete into `web/src/scanActions.js` (`renameScan`, `deleteScan` — Firestore doc update/delete incl. storage image cleanup) used by both `HistoryScreen` and the detail route. |
| Support | Inputs → `.ui-input`; submit → `.ui-btn-primary`; tokenize (`#fff`, `#b23b3b`, fallbacks). |
| Upgrade | CTA → `.ui-btn-primary`; features/price → `.ui-card`/tokens; tokenize (`#fff`, spinner). |
| Scope | These three screens + `ResultsScreen` history actions + the shared helper. No unrelated logic/data changes. |

## Architecture

### `web/src/scanActions.js` (new, shared)
- `renameScan(uid, scanId, name) -> Promise` — `updateDoc(users/{uid}/scans/{scanId}, { productName })`.
- `deleteScan(uid, scan) -> Promise` — `deleteDoc` the scan doc, and best-effort delete its Storage image if `scan.imageUrl` points to our bucket (match whatever `HistoryScreen.deleteScan` already does). No-throw on storage cleanup failure.
- `HistoryScreen` refactors its inline `saveName`/`deleteScan` to call these (behavior unchanged).

### `HistoryScreen` restyle
- `.hist-item` rows → `ui-card`; keep the editing/confirm-delete/action-button structure.
- Thumbnail (`.hist-item-thumb` / `.hist-thumb-img` / `.hist-thumb-placeholder`) → contained image on `--preview-bg` + a small **mode badge** overlay (reuse the `.scan-mode-badge`/`.scan-mode-*` styles or a shared variant); placeholder uses the mode glyph/barcode.
- Status: replace `FlagBadge` output with a `.ui-pill ui-pill-{safe|danger}` using `scanCardModel(scan)` (`status: 'safe'→safe`, `'flagged'→danger`; `label`).
- Save-to-list button (`.hist-edit-btn` aria-label "Save to list"): swap the bookmark `<path>` for the **bullet-list icon** (`M8 6h12M8 12h12M8 18h12` + three dot circles), matching the Lists tab.
- Tokenize `HistoryScreen.css` (`#fff` → `var(--white)`; any other hex → tokens).

### `ResultsScreen` — history actions (feature)
- New optional prop `historyActions` = `{ onRename(name): Promise, onDelete(): Promise } | null` (null/absent for fresh scans).
- When present:
  - **Name edit:** an edit (pencil) button beside `.results-product`; clicking swaps the name for an input with Save (calls `onRename`, then exits edit) / Cancel. Local component state; no change to the flag/dismiss logic.
  - **Delete:** a `.ui-btn` danger "Delete scan" at the bottom of `.results-scroll` (above the footer), with a lightweight inline confirm (Delete / Cancel), calling `onDelete`.
- `HistoryScanRoute` (App.jsx) passes `historyActions`: `onRename` = `renameScan(user.uid, scanId, name)` + update local `scan` state; `onDelete` = `deleteScan(user.uid, scan)` + `navigate('/history')`. Fresh-scan `/results` (`ResultsRoute`) passes no `historyActions`.

### `SupportScreen` + `UpgradeScreen` restyle
- Support: `.support-input`/`.support-textarea` → `.ui-input` (textarea keeps `resize`); `.support-primary` → `ui-btn ui-btn-primary`; tokenize.
- Upgrade: primary CTA → `ui-btn ui-btn-primary`; feature rows / price block → `.ui-card`/tokens; tokenize `#fff` (button text via `--white`, spinner via token).

## Accessibility (WCAG 2.1 AA)
- History rows/buttons keep labels + visible focus; status pills text-labeled; mode badge has `aria-label`.
- Detail rename: the edit button is labeled ("Edit name"); the input has an accessible name; Save/Cancel labeled. Delete button labeled with a confirm step.
- Contrast AA on cards/pills/buttons; icon-swap keeps the same accessible label ("Save to list").

## Testing
- **Unit (`node --test`):** existing helpers still pass; if any pure mapping is added it gets a test (none expected beyond reuse of `scanCardModel`/`scanModeBadge`).
- **Manual:** History rows are cards with mode badges + safe/flagged pills; inline rename, delete-confirm, and save-to-list (now bullet-list icon) all still work. On a scan's **detail page**: rename via pencil persists (reflected in History), and Delete removes it and returns to History. Support form styled + submits; Upgrade CTA/features styled.
- **Grep:** no hardcoded hex in `HistoryScreen.css` / `SupportScreen.css` / `UpgradeScreen.css` (allow `var(--white)`).
- **Build:** `vite build` clean.

## What Does Not Change
- Scan/flag/dismiss/save-to-list logic (only the rename/delete extraction, behavior-preserving, + the new detail-page entry points).
- Routing, persistent chrome, other screens/batches.

## Out of Scope (later / YAGNI)
- Batch D (Login/Legal/gate).
- Converting History to a full 2-col grid (chose B).
- The OFF-photo bug (separate).
- Any Upgrade/Support copy or flow changes.
