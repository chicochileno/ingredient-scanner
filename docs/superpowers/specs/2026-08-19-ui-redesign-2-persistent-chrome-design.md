# UI Redesign — Sub-project 2: Persistent Chrome + Scan-History Previews — Design Spec

**Date:** 2026-08-19
**Status:** Approved
**Builds on:** Sub-project 1 (nav shell + Home dashboard), which shipped the `AppShell`/`BottomNav`, `AccountMenu`, deep-green tokens, and the Home dashboard.

## Overview

Make the app's chrome **persistent across all in-app screens**: a single deep-green header (top) and the bottom-tab nav (bottom) frame every signed-in screen, replacing each screen's own header. Plus two polish items tied to the scan-history previews: constrain preview images (max 180px, letterboxed on a dark-gray backdrop) and add a **per-scan mode badge** (barcode / label / menu) so scan type reads at a glance. And a correctness fix: **persist and display the Open Food Facts product photo** for barcode scans (currently fetched by the server but dropped on the client).

## Program Context

Owner directive (2026-08-19): "I want the navigation at the bottom and the header to always be there unless I tell you otherwise — do this for all the screens." This revises SP1's decision that chrome appears only on the four tabs. It also front-loads the header/nav plumbing for the remaining screens; a later sub-project still restyles each screen's **body** to the new visual language (this sub-project is chrome + targeted polish, not a full body restyle — a style seam inside each screen persists until then).

## Design Decisions

| Question | Decision |
|----------|----------|
| Chrome scope | Persistent header + bottom nav on **all in-app (signed-in) screens**. |
| Chrome-free exceptions | **Login, Terms-acceptance gate, public Terms/Privacy pages, and the Scan camera.** (Pre-auth screens have no authenticated nav; the camera's own bottom capture controls + immersive viewfinder conflict with the chrome, and the nav's FAB already opens it.) |
| Header content | One contextual deep-green bar: **right** = account avatar → popover (moved out of Home, now global); **left** = logo on the 4 tabs / back arrow on sub-screens; **center** = screen title. |
| Back behavior | **Logical-parent map**, not plain browser-back (so Results → Home rather than back to the transient camera). |
| Per-screen headers | Each in-app screen's own header/back bar is **removed** so there is exactly one header. |
| Scan-history preview image | **max-height 180px**, **`object-fit: contain`** on a **dark-gray backdrop** (letterbox/pillarbox), replacing the current cropped `cover`. Applied to the Home dashboard Scan History grid (full History screen: later). |
| Scan-type indicator | **Mode badge on every scan card** (option A): barcode icon (barcode), camera icon (label), utensils/menu icon (menu). Plus a large barcode illustration on the dark-gray backdrop for barcode scans with no photo. |
| Open Food Facts photo | **Fix:** persist and show `data.imageUrl` (OFF `product.image_url`) when there's no user camera photo. Makes barcode product photos appear in Results, history detail, and the Home grid. |

## Architecture

### `AppShell` — persistent frame
Grows from "content + bottom nav" to **AppHeader (top) + scrolling content + BottomNav (bottom)**. The layout route wraps **all in-app screens**: `/home`, `/history`, `/profiles`, `/lists`, `/results`, `/menu-results`, `/history/:scanId`, `/lists/:listId`, `/profiles/:profileId`, `/support`, `/upgrade`, `/upgrade/success`. Outside the shell (chrome-free): `/` (login), the Terms gate, `/terms`, `/privacy`, `/scan`.

In `App.jsx`, move the currently-standalone in-app routes (results, menu-results, history detail, list detail, profile editor, support, upgrade) **into the AppShell layout route** (they keep their `RequireAuth` via the shell's wrapper). `/scan` stays a standalone chrome-free route.

### `AppHeader` — contextual persistent header
- Deep-green bar (`--sage-deep`, `--on-chrome`).
- **Right:** the account avatar button → `AccountMenu` popover (relocated from `HomeScreen`; now rendered by the header so it's on every screen). The "How are ingredients flagged" About sheet moves here too.
- **Left:** on the 4 tab routes, the app logo/wordmark; on sub-screens, a **back arrow** that navigates to the screen's logical parent.
- **Center:** the screen title.
- Content comes from a pure **`headerForRoute(pathname)` → `{ title, showLogo, backTo }`**:
  - `/home` → `{title:'IngredientScan', showLogo:true, backTo:null}` (tab)
  - `/history` → `{title:'History', showLogo:true, backTo:null}` (tab)
  - `/profiles` → `{title:'Profiles', showLogo:true, backTo:null}` (tab)
  - `/lists` → `{title:'Lists', showLogo:true, backTo:null}` (tab)
  - `/results` → `{title:'Results', backTo:'/home'}`
  - `/menu-results` → `{title:'Menu Results', backTo:'/home'}`
  - `/history/:id` → `{title:'Scan', backTo:'/history'}`
  - `/lists/:id` → `{title:'List', backTo:'/lists'}`
  - `/profiles/:id` → `{title:'Edit Profile', backTo:'/profiles'}`
  - `/support` → `{title:'Support', backTo:'/home'}`
  - `/upgrade`, `/upgrade/success` → `{title:'Upgrade', backTo:'/home'}`
  - Unknown → `{title:'', showLogo:true, backTo:null}` (safe default).

### Per-screen header removal
Remove the in-content header/back bar from each in-app screen so the global header is the only one: `HomeScreen` (drop `.home-header`), `HistoryScreen`, `ProfilesScreen`, `ListsScreen`, `ResultsScreen`, `MenuResultsScreen`, `SupportScreen`, `ProfileEditor`, `UpgradeScreen`, `ListDetailScreen`. Their `onBack` props/back buttons are dropped; back lives in the global header. Each screen becomes **content-only**, rendering in the shell's scrolling content area. Minimal per-screen CSS fixes so each sits correctly between header and nav (no full body restyle).

### Scan-history preview + mode badge (Home grid)
In the Home `scan-card`:
- Image container: fixed **max-height 180px**, dark-gray background (add `--preview-bg` ≈ `#2B2E2B`), image `object-fit: contain` centered (letterbox/pillarbox).
- **Mode badge:** a small icon chip in the card's top-left corner reflecting `scan.mode` (barcode / camera→label / menu). New pure helper **`scanModeBadge(mode)` → `{ key, label }`** (`key` ∈ `'barcode' | 'label' | 'menu'`) selects the icon + accessible label; the icon SVGs live in the component.
- No-photo barcode: render a barcode illustration on the dark-gray backdrop (other modes keep their existing glyph fallback).

### Open Food Facts image fix
In `App.jsx` `handleResult`, for non-menu scans set the saved image to `imageUrl || data.imageUrl || null` (uploaded camera photo first, else the OFF product URL), and pass the same value in the `/results` navigate state so the live Results screen shows it. No server change (the server already returns `imageUrl`). Note: this stores the **external OFF URL** (not re-hosted); acceptable for now (could rot if OFF removes the image; re-hosting to Storage is a possible later improvement).

## Accessibility (WCAG 2.1 AA)
- One header with a clear title per screen; the back control is a labeled button ("Back"); the avatar button keeps `aria-haspopup`/`aria-expanded`; popover focus management unchanged from SP1.
- Bottom nav labeled with `aria-current` (unchanged).
- Mode badge carries an accessible label (e.g. `aria-label="Barcode scan"`), so scan type isn't conveyed by icon alone.
- Dark-gray preview backdrop + white content and pill contrasts verified ≥ AA.

## Testing
- **Unit (`node --test`):** `headerForRoute(pathname)` for each mapped route + the unknown default; `scanModeBadge(mode)` for barcode/camera/menu/unknown.
- **Manual:** header shows on every in-app screen with correct title; logo on tabs, back arrow on sub-screens routing to the mapped parent; account popover reachable from every screen; bottom nav present everywhere except the four exceptions (Login, Terms gate, Terms/Privacy, Scan); Scan camera and pre-auth screens remain chrome-free; scan-history previews are ≤180px, letterboxed on dark gray; mode badges correct per scan; a **barcode scan now shows its OFF product photo** in Results, history detail, and the Home grid.
- **Accessibility (manual + axe):** header title/back labels, badge labels, contrast, popover focus.
- **Build:** `vite build` clean.

## What Does Not Change
- Firestore schema, auth, billing, scanning logic, the server (`imageUrl` already returned).
- The bodies of each screen (content/layout inside) beyond the minimal fixes to fit the frame — full restyle is a later sub-project.
- SP1's `BottomNav`, `AccountMenu`, tokens, and Home dashboard structure (the header extraction relocates the avatar/popover but keeps their behavior).

## Out of Scope (later / YAGNI)
- Full visual restyle of each screen's body content (later sub-project).
- Applying the 180px/letterbox preview treatment to the full History screen (do it when that screen is restyled — or a fast follow if wanted).
- Re-hosting OFF images to Firebase Storage for permanence.
- Per-scan dynamic header titles (e.g. product name on the history-detail header) — static titles for now.
