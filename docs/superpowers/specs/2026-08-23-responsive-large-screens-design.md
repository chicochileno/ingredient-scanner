# Responsive / Larger Screens — Design Spec

**Date:** 2026-08-23
**Status:** Approved
**Builds on:** The persistent-chrome `AppShell` (fixed full-viewport shell) and the design tokens.

## Overview

Make the app look intentional on tablet/desktop (and future large iOS-app windows) without a separate desktop UI. On screens wider than the frame, present the phone-first app as a **centered ~640px column** over a **muted backdrop** (no fake-phone/device chrome), and let the Home Scan History grid use the extra width (2 cols on phone → 3 on the frame). One layout everywhere — phone, desktop browser, and the Capacitor iOS app.

## Program Context

First item in the current roadmap ([[project-roadmap]]); precedes finishing the Capacitor iOS app and the marketing landing page. Chosen approach "C" (wider centered hybrid, ~640px, muted backdrop, no device frame).

## Design Decisions

| Question | Decision |
|----------|----------|
| Approach | Centered **640px** frame; full-bleed on phones (< 640px), centered column on wider screens. Not a true desktop rebuild. |
| Backdrop | New `--backdrop` token — a muted, desaturated sage-gray slightly darker than `--bg`; fills the space around the frame. |
| Frame chrome | A **subtle soft edge-shadow** on the app column (content-column separation, not rounded/device chrome). No rounded corners. |
| Grids | Home Scan History grid → `repeat(auto-fill, minmax(180px, 1fr))` (2 cols phone → 3 on the frame). Other screens are single-column content — no change beyond the roomier width. |
| Scope | CSS only: `.app-shell` (cap + center + shadow), body backdrop + token, Home grid columns. No JS/layout-paradigm changes. |

## Architecture

- **`index.css`:** add `--backdrop` token; set `html, body` background to `var(--backdrop)` (harmless on phones — the app fills the viewport).
- **`AppShell.css`:** `.app-shell` gains `max-width: 640px; margin: 0 auto;` (keeping `position: fixed; inset: 0` so `left/right: 0 + margin auto` centers it) and a soft `box-shadow`. Header/content/nav are `flex` children, so they automatically span the 640px frame.
- **`HomeScreen.css`:** `.home-history-grid` → `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));`.

## Accessibility
- No content/interaction changes; contrast unaffected (backdrop is outside the app surface). Frame remains keyboard/scroll-navigable exactly as now.

## Testing
- **Manual:** at desktop width the app is a centered 640px column on the muted backdrop with a soft edge-shadow (no device frame); Home history shows 3 columns; at phone width it's unchanged (full-bleed, 2 columns). Header + bottom nav span the frame, not the whole screen. Spot-check Results/Lists/Profiles/Support/Upgrade/History look comfortable at 640px.
- **Build:** `vite build` clean.

## What Does Not Change
- The mobile layout/behavior, chrome, routing, logic. Phones look identical.

## Out of Scope (later / YAGNI)
- A true desktop layout (side nav, multi-column screens) — deliberately rejected (approach B).
- Per-screen desktop redesigns beyond the Home grid.
