# UI Redesign 3D (Login/Legal/Gate) + History Per-Person Flags — Design Spec

**Date:** 2026-08-22
**Status:** Approved
**Builds on:** Batch A–C (`patterns.css` `.ui-*`, tokens, `scanCardModel`, `rematchBatch` client + `/scan/rematch-batch` endpoint).

## Overview

Two bundled pieces:
1. **History per-person flags (bug fix):** History cards currently show only the *first* profile's flag count (`scan.flagged` = `profiles[0].flagged`), so a scan flagged 1 for Rosa and 2 for Anne shows just "Flagged 1". Fix: compute **live per-profile** flags for each scan (via `rematchBatch` for non-menu scans, `menuSnapshot.profiles` for menu scans) and show a **per-person pill** per profile on each card (multi-profile families); solo families keep the single Safe/Flagged pill.
2. **Batch D restyle (final):** Login, Legal pages (`/terms`, `/privacy`), and the Terms-acceptance gate onto tokens + `.ui-*`; tokenize their hardcoded hex.

## Program Context

Completes SP3 (A scan output, B profiles/lists, C history/support/upgrade, **D auth/legal**). The History fix corrects a real per-profile calculation bug surfaced by the owner. After this, the whole app is on the design language.

## Design Decisions

| Question | Decision |
|----------|----------|
| History flag source | **Live per-profile** via `rematchBatch(non-menu scans by rawText)` + `menuSnapshot.profiles` for menu scans — not the stale stored `scan.flagged`. Reflects current profile config (like the detail view). |
| History display | **Per-person pills** on each card for multi-profile families: `"{name} {count}"`, danger variant when count>0, safe/neutral when 0. Solo family (1 profile) → the existing single Safe/Flagged pill. |
| Loading | Cards show a subtle placeholder pill until the batch resolves, then fill in (History open isn't blocked). |
| Batch D scope | Restyle Login, `/terms` + `/privacy` pages, Terms gate onto tokens + `.ui-*`; tokenize hex. Pre-auth/public → chrome-free (unchanged). |
| No data migration | Fix is read-side (recompute on view); existing stored scans need no change. |

## Architecture

### History per-person flags — `HistoryScreen`
- After the existing `getDocs` load, compute per-scan per-profile summaries:
  - **Non-menu** scans with `rawText`: one `rematchBatch([{ itemId: scan.id, rawText }])` call → `results[i].profiles` = `[{ profileId, name, flagged, counts }]`. Per profile `count = flagged.length`.
  - **Menu** scans: `scan.menuSnapshot.profiles` = `[{ profileId, name, flaggedCount }]`. Per profile `count = flaggedCount`.
  - Normalize both to `perProfile: [{ name, count }]` keyed by scan id in component state (e.g. `flagsByScan`).
- New pure helper (unit-tested) `web/src/historyFlags.js`:
  - `perProfileFromRematch(profilesArr) -> [{ name, count }]`
  - `perProfileFromMenu(menuProfilesArr) -> [{ name, count }]`
  - `statusPills(perProfile) -> { multi: boolean, pills: [{ name, count, variant }] , solo: { status, label } }` — encapsulates the solo-vs-multi + variant logic so the component just renders.
- Replace the current `StatusPill` (which used `scanCardModel(scan)`) with rendering from `flagsByScan[scan.id]` via `statusPills(...)`. While a scan's entry is absent (batch pending), render a `.hist-status-loading` placeholder.
- `rematchBatch` items cap is 200 (History loads ≤100) — one call. Menu scans excluded from the batch (empty rawText).

### Batch D — Login / Legal / Terms gate
- **LoginScreen:** primary Google button and any inputs → `.ui-btn`/`.ui-input` where they fit (keep the Google button's brand treatment if it has one — don't force-recolor the Google mark); tokenize `LoginScreen.css` hex; footer legal links stay.
- **LegalPages (`/terms`, `/privacy`):** tokenize `LegalPages.css` (banner colors `#fff4e5`/`#f0c27b`/`#7a4a00` → `--warning-light`/`--warning`; links → `--sage`); headings on `--font-display`; content in `.ui-card`-ish container if it improves it (keep readable measure).
- **TermsGate:** the accept card → `.ui-card`/tokens; "Agree & Continue" → `.ui-btn-primary`; checkbox row + "Sign out" tokenized; tokenize `TermsGate.css` hex (`#fff4e5` etc.).
- All three are pre-auth/public and stay chrome-free.

## Accessibility (WCAG 2.1 AA)
- Per-person pills are **text-labeled** ("{name} {count}"), not color-only; danger/safe token pairs pass AA.
- Login/gate buttons keep labels + visible focus; legal pages keep heading hierarchy + contrast.

## Testing
- **Unit (`node --test`):** `perProfileFromRematch`, `perProfileFromMenu`, and `statusPills` (solo safe/flagged; multi with mixed counts → correct pills/variants; null names → 'Unnamed').
- **Manual:** History multi-profile scan shows per-person pills with correct counts (e.g. Rosa 1, Anne 2); solo family shows the single pill; menu scans show per-person from snapshot; placeholder appears briefly then fills. Login/legal/gate render on the new tokens, and the gate still blocks + accepts.
- **Grep:** no hardcoded hex in `LoginScreen.css` / `LegalPages.css` / `TermsGate.css` (allow `var(--white)`).
- **Build:** `vite build` clean.

## What Does Not Change
- Scan/flag matching logic (reusing `rematch-batch`), routing, persistent chrome, other screens.
- Stored scan data (fix is recompute-on-view).

## Out of Scope (later / YAGNI)
- Storing per-profile counts at scan time (recompute-on-view is sufficient and always current).
- The OFF-photo bug (still deferred, separate).
- Any Login auth-flow changes.
