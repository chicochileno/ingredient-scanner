# UI Redesign — Sub-project 3, Batch B: Profiles & Lists Restyle — Design Spec

**Date:** 2026-08-20
**Status:** Approved
**Builds on:** Batch A's shared `patterns.css` (`.ui-card`, `.ui-pill`+variants, `.ui-btn`+primary/secondary, `.ui-section-title`, `.ui-preview`) and the design tokens.

## Overview

Restyle the **Profiles & Lists** screen family onto the shared `.ui-*` patterns and eliminate their color drift (`#fff`, `#3a7`, `#fecaca`, `#E7B7B3`). Screens: `ProfilesScreen` (profile list), `ProfileEditor`, `ListsScreen` (list index + the create form), `ListDetailScreen`. Extrapolated design language (no mockups); visual only — no logic/data changes.

## Program Context

SP3 Batch B (after A — Scan output). Reuses the Batch A foundation. Remaining batches: C (History/Support/Upgrade), D (Login/Legal/gate).

## Design Decisions

| Question | Decision |
|----------|----------|
| Rows/cards | Profile rows, list rows, and list-detail item rows → **`.ui-card`** (tappable). |
| Chips/pills | Preset chips and list-detail filter pills → **`.ui-pill`** (toggle style; selected uses `--sage`). |
| Buttons | "New list" create + primary actions → **`.ui-btn-primary`**; "Delete profile/list" → **`.ui-btn`** danger (outline `--danger`), replacing `#fecaca`. "+ Add profile" stays a distinct dashed affordance, tokenized. |
| Category switches | ProfileEditor's `.pe-switch` toggle-list is **kept as its custom control** (already on-design) — tokenized/tidied, not forced into a card/pill. |
| Inputs | Introduce a shared `.ui-input` in `patterns.css` for the name/create text inputs, for consistency. |
| Item thumbnails | List-detail thumbnails stay compact (not the full 180px preview); just tokenize the placeholder. |
| Color drift | Replace all hardcoded hex with tokens (`--surface`/`--sage`/`--danger`/`--border`), verified by a "no hardcoded hex" grep. |
| Scope | Bodies of the four screens + one shared `.ui-input`. No logic/data/routing changes. |

## Architecture

### `patterns.css` (extend)
Add one shared input class:
- `.ui-input` — `width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; background:var(--surface); color:var(--ink); font:inherit;` with a `:focus-visible` outline in `--sage`.

### `ProfilesScreen`
- `.profile-row` → `ui-card profile-row` (keep the name/sub layout); tokenize.
- `.profiles-add` → tokenized dashed add card (kept distinct from `.ui-card`).

### `ProfileEditor`
- Preset chips (`.pe-preset`) → `ui-pill` base + selected/`--sage` state.
- Name field → `.ui-input`.
- `.pe-switch` list: tokenize on/off (on → `--sage-light`/`--safe`), keep control shape.
- Delete → `ui-btn` danger outline (`--danger` text/border, `--surface` bg); drop `#fecaca`/`#fff`.

### `ListsScreen` + `ListDetailScreen`
- `.list-row` and `.ld-item` → `ui-card`.
- Create input (`.allergen-input` reuse or `.ui-input`) + "Create" → `ui-btn-primary`.
- `.ld-filter-btn` → `ui-pill` toggle (active → `--sage`).
- `.ld-name` (list name input) → `.ui-input` styling (inline, borderless-on-chrome is fine — tokenize).
- `.ld-thumb` placeholder background → token (`--card`/`--preview-bg`); `.ld-remove`/`.ld-delete` → tokenized danger.

## Accessibility (WCAG 2.1 AA)
- Cards/rows remain buttons with visible focus; pills text-labeled; toggle switches keep their state text (`On`/`Off`) — not color-only.
- Danger actions have text ("Delete …") + sufficient contrast (`--danger`).
- Inputs keep visible focus and labels.

## Testing
- **Manual:** Profiles list + editor and Lists index + detail read as one system with Home/Results; presets/filters toggle; add/create/delete still work; switches toggle categories.
- **Grep:** no hardcoded hex remains in `ProfilesScreen.css` / `ListsScreen.css` (allowing token `var(--white)` where white is needed).
- **Accessibility (manual + axe):** focus, pill/label text, contrast.
- **Build:** `vite build` clean.

## What Does Not Change
- Profile/list data, category/allergen logic, share flow, routing, the persistent chrome.
- Batches C/D screens.

## Out of Scope (later / YAGNI)
- History/Support/Upgrade (C), Login/Legal/gate (D).
- Applying the full 180px preview to list-detail thumbnails.
- Any interaction/content changes.
