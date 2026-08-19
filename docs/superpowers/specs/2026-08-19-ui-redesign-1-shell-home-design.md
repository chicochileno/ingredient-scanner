# UI Redesign — Sub-project 1: Navigation Shell + Home Dashboard — Design Spec

**Date:** 2026-08-19
**Status:** Approved
**Builds on:** Existing green design tokens (`web/src/index.css`), React Router v7 routing in `App.jsx`, the `useProfiles` / `useBilling` hooks, and the `users/{uid}/scans` Firestore collection.

## Overview

Phase 1 of a full UI restructure (Option A) based on the owner's mockups. This sub-project delivers the **redesigned core**: a green-forward chrome, a persistent **bottom-tab navigation shell with a center scan FAB**, and a rebuilt **Home dashboard** (account popover, free-tier upgrade banner, a horizontal Family Profiles card row, and an independently-scrolling Scan History photo grid). Later sub-projects restyle the remaining screens to match.

The app is **already green-themed**; the mockups are navy only because they came from Stitch (AI UI generator) and are treated as **directional**, not pixel-exact. The redesign renders the mockup's navy chrome in the app's existing green tokens.

## Program Context

The owner approved a full Option-A restructure, decomposed into sub-projects (each its own spec → plan → build). **This is Sub-project 1** — the navigation shell + Home dashboard + theming foundation, fully specified by the two Home mockups provided. Sub-project 2+ will restyle Results, Menu results, Scan, Profiles/editor, Lists, full History, Login, Support, Legal, and Upgrade. A visual seam between the new chrome/dashboard and the not-yet-restyled screens is expected until those land.

## Design Decisions

| Question | Decision |
|----------|----------|
| Scope | Full restructure (Option A), phase 1 = nav shell + Home + theming. |
| Primary color | **Green, not navy.** Deep green `--sage-deep` (#2E4B33) for header / bottom nav / scan FAB; white/off-white content on top. |
| Brand green vs. safe green | Deep-green chrome; brighter `--safe` (#256B38 on `--safe-light`) for "Safe" pills — kept distinct. |
| Navigation model | Persistent **bottom tab bar** (Home · History · Profile · Lists) + **center scan FAB**, replacing button-based navigation. |
| Where the shell shows | **Only on the 4 primary tabs.** Hidden on deep/full-screen contexts (Scan, Results, Menu results, Profile editor, Support, Upgrade, Login, Terms, Privacy). |
| Free-tier scan counter / Upgrade | **Slim banner under the header** (free users only); hidden for subscribers. |
| Support link | In the **account popover** (info section). |
| "Manage subscription" | In the account popover, **shown only to subscribers**. |
| Profile card tap | Opens that profile's **`ProfileEditor`** (view + manage). The "Expand" label becomes "tap to view/manage." |
| Adding a profile | A trailing **"+ Add profile"** card at the end of the Home row (Profile tab also manages/adds). |
| Scan History on Home | Up to **8** recent scans in a 2-column photo grid; the **history section scrolls independently** (header + upgrade banner + profiles row stay pinned; the grid scrolls from under "Scan History" down to the bottom nav). "View All" → full History. |
| Fonts | Unchanged — Bricolage Grotesque (display), DM Sans (body). |
| Accessibility | WCAG 2.1 AA — labeled nav with `aria-current`, focus-managed popover, text-labeled status pills, ≥44px targets, verified contrast. |

## Architecture & Layout

### Theming (`web/src/index.css` + token cleanup)
- Add any chrome tokens needed on top of the existing set (e.g. an explicit `--on-chrome` = #FFFFFF/off-white for text/icons over deep green). Reuse existing `--sage-deep`, `--sage`, `--safe`, `--danger`, `--bg`, `--radius`, `--shadow`.
- **Consolidate drifted greens:** replace the hardcoded `#4a7c59` / `#2f6b46` in `MenuResultsScreen.css`, `TermsGate.css`, `SupportScreen.css`, `LoginScreen.css`, `HomeScreen.css`, and the legal footer link styles with the token equivalents (`--sage` / `--sage-deep`). No visual regression intended — just token unification.

### Navigation shell — `web/src/AppShell.jsx` + `web/src/AppShell.css`
- A **layout route** component: renders `<Outlet />` for the active tab plus a fixed **`<BottomNav />`** (deep-green bar) with four tabs and a raised center **scan FAB**.
- **Tabs → routes:** Home → `/home`, History → `/history`, Profile → `/profiles`, Lists → `/lists`. FAB → `/scan`.
- Active tab: deep-green fill/accent + `aria-current="page"` (derived from `useLocation`).
- In `App.jsx`, wrap the four tab routes in a parent `<Route element={<AppShell/>}>` (React Router v7 layout route). The other authenticated routes (`/scan`, `/results`, `/menu-results`, `/support`, `/upgrade`, `/terms`, `/privacy`, `/history/:scanId`, `/lists/:listId`, `/profiles` editor sub-flows) render **outside** the shell (no bottom nav). Public routes (`/`, `/s/:shareId`, legal) and the Terms Gate are unaffected.
- `RequireAuth` still guards each tab; the shell renders only for authenticated users.

### Home dashboard — rebuilt `web/src/HomeScreen.jsx` + `web/src/HomeScreen.css`
Fixed top region (pinned) + independently scrolling history region:

1. **Header (deep green, pinned):** app logo (left); **account avatar** button (right) using `user.photoURL` (fallback: initial) → opens the account popover.
2. **Upgrade banner (free users only, pinned):** "`{scanCount}` of 10 free scans used · **Upgrade**" + thin progress bar; `atLimit` → "Free scans used up." Hidden when `subscriptionStatus === 'active'`. Upgrade → `/upgrade`.
3. **Family Profiles (pinned):** a horizontal-scroll row of profile cards — colored initial-avatar (deterministic per profile), name, allergen/category summary; tap → `ProfileEditor` for that profile. Trailing **"+ Add profile"** card → new-profile flow. Empty (no profiles) → just the "+ Add profile" card with a one-line hint.
4. **Scan History (scrolls independently):** a pinned section header ("Scan History" + "View All" → `/history`), then a **2-column photo grid** filling the remaining height down to the bottom nav, scrollable within itself. Shows up to **8** most-recent scans (`users/{uid}/scans`, `orderBy('createdAt','desc')`, `limit(8)`). Each card: product image (or a mode glyph fallback), name, and a status pill. Tap → that scan's detail (`/history/:scanId`). Empty (no scans) → a friendly "Scan your first product" prompt pointing at the FAB.

### Account popover — `web/src/AccountMenu.jsx` (+ styles)
Anchored to the header avatar; focus-managed menu (`role="menu"`, Esc / outside-click closes, focus trap while open):
- **Sign out** (`signOut(auth)`)
- **Manage subscription** — only if `subscriptionStatus === 'active'` (Stripe customer portal, existing flow)
- *(divider)*
- **Terms of Service** (`/terms`) · **Privacy Policy** (`/privacy`) · **How are ingredients flagged** (existing About content) · **Support** (`/support`)

### Pure helpers (unit-tested) — `web/src/homeModel.js`
- `profileAvatar(profile) -> { initial, color }` — first letter of `name` (fallback e.g. "?"), color chosen deterministically from a small fixed palette by profile id/order. No IO.
- `scanCardModel(scan) -> { name, imageUrl, status, label }` — `name` = `productName` or a mode-based fallback ("Menu scan" | "Barcode scan" | "Label scan"); `status` = `'safe' | 'flagged'` (menu scans use `menuSnapshot`: flagged if any profile `flaggedCount > 0`; others use `flagged.length`); `label` = "Safe" or "Flagged" (with count when > 0). No IO.

### Data
- Reuses `useProfiles` (profiles row) and `useBilling` (upgrade banner / popover) unchanged.
- New: a small Home scans query (or a `useRecentScans(user, 8)` hook) reading the same `users/{uid}/scans` collection HistoryScreen uses, limited to 8, newest first. Firestore rules unchanged (scans already owner read/write).

## Accessibility (WCAG 2.1 AA)
- Bottom nav is a labeled `<nav>`; each tab a link/button with a visible label + `aria-current`; FAB labeled "Scan". Touch targets ≥ 44px.
- Account popover: `role="menu"` / `menuitem`, opens with focus on the first item, Esc and outside-click close, focus returns to the avatar.
- Status pills carry text ("Safe" / "Flagged"), never color alone.
- White-on-deep-green (#FFFFFF on #2E4B33) and pill contrasts verified ≥ AA.
- Independent-scroll history region remains keyboard-scrollable and doesn't trap focus.

## Testing
- **Unit (`node --test`, `web` is ESM):** `profileAvatar` (initial + deterministic color; missing-name fallback) and `scanCardModel` (product vs mode-fallback names; safe vs flagged for label/barcode; menu via `menuSnapshot`; empty flagged → safe).
- **Manual:** bottom-nav switches tabs with correct active state; FAB → scan; account popover opens/closes (Esc/outside), all items route correctly, "Manage subscription" only for subscribers; upgrade banner shows for free users and hides for subscribers; profiles row taps into the editor; "+ Add profile" works; history grid shows ≤ 8, scrolls independently under a pinned header, tapping opens the scan; empty states for no profiles / no scans.
- **Accessibility (manual + axe):** nav labels/`aria-current`, popover focus management, pill text, contrast, keyboard scroll of the history region.
- **Build:** `vite build` clean.

## What Does Not Change
- Firestore schema, auth, billing/Stripe, scanning, and all business logic.
- The other screens' internals (they still function; restyled in later sub-projects).
- Routing targets/URLs — the same routes exist; only the chrome/navigation wrapper is new.

## Out of Scope (later sub-projects / YAGNI)
- Restyling Results, Menu results, Scan, Profiles/editor, Lists, full History, Login, Support, Legal, Upgrade (Sub-project 2+).
- Any new features or data changes.
- A separate "expand profile inline" interaction (tap goes to the editor instead).
- Deriving a specific flagged category label like "Flagged: Sugar" (the mockup's example) — the pill shows "Safe" / "Flagged (+count)" from real data; category-specific labels can come later if wanted.
- Bottom nav on non-tab screens (deep screens intentionally omit it).
