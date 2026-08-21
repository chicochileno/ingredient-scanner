# UI Redesign — Sub-project 3, Batch A: Scan Output Restyle — Design Spec

**Date:** 2026-08-20
**Status:** Approved
**Builds on:** SP1 (Home dashboard + tokens) and SP2 (persistent chrome, scan-card preview treatment). This is the first batch of the body restyle.

## Overview

Restyle the **scan-output screens** — `ResultsScreen` and `MenuResultsScreen` — to the app's design language, and establish a small set of **reusable UI pattern styles** (cards, status pills, section titles, buttons, preview boxes) that the later restyle batches (B/C/D) adopt so the extrapolated look stays consistent. The design language is **extrapolated** (no mockups beyond Home): deep-green chrome (done), white rounded cards on the tokens, sage accents, text-labeled safe/flagged/severity pills, Bricolage display headings + DM Sans body. Visual only — no behavior changes except extracting one pure severity→pill helper.

## Program Context

SP3 (full body restyle) is decomposed into batches, done in order: **A — Scan output (this spec)**, B — Profiles & Lists, C — History & account, D — Pre-auth/public. Batch A establishes the shared pattern foundation. Screen **bodies** were left in old styling under the new frame after SP2; this batch begins bringing them onto the design language. (Known deferred bug, unrelated: OFF product photos still not appearing — its fix will be most visible on the restyled Results photo; tracked separately.)

## Design Decisions

| Question | Decision |
|----------|----------|
| Source of the look | **Extrapolate** the design language (deep-green chrome, token-based cards/pills/buttons/type). No new mockups. |
| Shared foundation | Add `web/src/patterns.css` with reusable `.ui-*` classes (card, pill + variants, section title, buttons, preview) imported globally; Results/MenuResults adopt them; B/C/D reuse them. |
| Results product photo | Apply the **same preview treatment as the Home grid** — `object-fit: contain` on a dark `--preview-bg`, height-capped (via `.ui-preview`). |
| Severity/status pills | One pill system: `safe` (`--safe`), `moderate`/`possible` (`--warning`), `high` (`--danger`) on `-light` backgrounds; text-labeled. A pure `severityPill(item)` maps a flag to `{ variant, label }`. |
| Color drift | Replace MenuResults hardcoded reds/greens (`#a33`, `#fdecec`, `#e0b4b4`, `#d98b8b`, `#9ec5a1`, `#7a4a00`, `#3a6b47`, `#f1f7f2`, `#fdecec`) with tokens. |
| Scope | Bodies of Results + MenuResults + the shared pattern layer. No logic/data changes. |

## Architecture

### `web/src/patterns.css` (new, imported once in `main.jsx`)
Reusable, token-based component classes (prefixed `ui-` to avoid collision with existing per-screen classes during migration):
- `.ui-card` — `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px 16px;`
- `.ui-section-title` — `font-family: var(--font-display); font-size: 1.1rem; margin: 0 0 10px;`
- `.ui-pill` (+ `-safe` / `-warning` / `-danger` / `-neutral`) — pill shape, text-labeled, `-light` bg + solid token text color.
- `.ui-btn`, `.ui-btn-primary` (`--sage` fill, white text), `.ui-btn-secondary` (outline) — consistent radius/padding, ≥44px height.
- `.ui-preview` + `.ui-preview img` — the dark-gray contain box: `background: var(--preview-bg); display:flex; align-items:center; justify-content:center; max-height:180px;` with the image `object-fit: contain; max-width/height:100%`.

### `web/src/resultsModel.js` (new, pure) + test
- `severityPill(flag) -> { variant, label }` where `variant` ∈ `'safe' | 'warning' | 'danger' | 'neutral'`:
  - `flag.tier === 'possible'` → `{ variant: 'warning', label: 'Worth checking' }`
  - `flag.severity === 'high'` → `{ variant: 'danger', label: 'High concern' }`
  - `flag.severity === 'moderate'` → `{ variant: 'warning', label: 'Moderate concern' }`
  - otherwise → `{ variant: 'neutral', label: 'Flagged' }`
- Preserves the current `SeverityBadge` behavior; the component uses this + the `.ui-pill-{variant}` classes.

### `ResultsScreen` restyle
- Flagged-ingredient cards → `.ui-card`; the severity badge uses `severityPill` + `.ui-pill-*`; section titles → `.ui-section-title`; the "No flags found" banner uses `--safe-light`/`--safe`.
- Wrap `results-photo` in `.ui-preview` (contain on dark backdrop, capped) — consistent with the Home grid and where the OFF-image fix will show.
- Footer buttons ("Save to list" / "New scan") → `.ui-btn-secondary` / `.ui-btn-primary`.
- No changes to the flag data, dismiss flow, or profile-chip logic.

### `MenuResultsScreen` restyle
- Replace hardcoded colors with tokens throughout.
- Per-child chips → `.ui-pill` style (selected state uses `--sage`).
- "Avoid / check" and "Looks OK" dish rows → `.ui-card` with a status accent; category chips → `.ui-pill-warning`/neutral; caveat banner stays prominent on `--warning-light`/`--warning`.
- Footer "New scan" → `.ui-btn-primary`.

## Accessibility (WCAG 2.1 AA)
- Pills remain **text-labeled** (never color-only); token pairings (`--danger` on `--danger-light`, etc.) verified ≥ AA.
- Buttons keep visible focus; ≥44px targets.
- Preview images are decorative (`alt=""`) where a product name is already shown; the dark backdrop keeps sufficient contrast for any overlaid text/badge.

## Testing
- **Unit (`node --test`):** `severityPill` for possible / high / moderate / default cases.
- **Manual:** Results shows restyled cards + severity pills + capped/contained product photo; MenuResults shows tokenized chips/cards/caveat; both screens read as one system with Home; dismiss + chip selection still work.
- **Accessibility (manual + axe):** pill text + contrast, button focus, image alts.
- **Build:** `vite build` clean.

## What Does Not Change
- Scan/flag/dismiss logic, data shapes, routing, the persistent chrome.
- Other screens (batches B/C/D) — still old-styled bodies until their batch.
- The deferred OFF-image bug (separate fix).

## Out of Scope (later batches / YAGNI)
- Restyling Profiles/Lists (B), History/Support/Upgrade (C), Login/Legal/gate (D).
- Refactoring Home's existing `.scan-card-img` to `.ui-preview` (leave working; can converge later).
- Any new interactions or content changes on Results/MenuResults.
