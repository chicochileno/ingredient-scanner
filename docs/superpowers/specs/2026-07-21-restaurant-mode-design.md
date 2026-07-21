# Restaurant Mode — Design Spec

**Date:** 2026-07-21
**Status:** Approved
**Builds on:** System 1 (matching/categories), System 2 (profiles), System 3 (lists — history/rematch patterns).

## Overview

Let parents scan a **restaurant menu** (photo or pasted text) and see, per child,
which dishes **likely** contain concerning ingredients. Because menus are prose
written in *dish language* ("Chicken Alfredo," "breaded cutlet") and omit
sub-ingredients, keyword matching can't do this — so **Claude (Haiku) reads the
menu** and returns per-dish likely-concerns, which the app maps to the existing
per-profile model. Framed throughout as **"likely, not a guarantee — confirm with
staff."**

## Program Context

The 5th piece of the feature program (the four "systems" + Restaurant Mode).
Substitutes (3b) and the marketing landing page come after. Note: a **Terms-of-Service
acceptance gate** (separate backlog item) must, when built, explicitly state that
results — especially Restaurant Mode's — are not a guarantee and AI can make
mistakes. That gate is out of scope here.

## Design Decisions

| Question | Decision |
|----------|----------|
| How menus are understood | **Claude Haiku 4.5** reads the menu (structured JSON output). Keyword/lexicon approaches rejected — they can't map dish language to categories. |
| Per-profile | Claude returns per-dish **categories + allergens**; the **app** maps to per-profile flags using existing logic (one Claude call serves the whole family). |
| Input | **Menu photo** (→ Google Vision OCR → text) **or pasted text** (skips OCR). |
| Result | Menu variant: caveat banner + per-child chips + "Avoid/check" and "Looks OK" dish lists. Everything says **"likely," never "contains."** |
| Billing | **Consumes one scan** (same free-10 limit; that controls cost). No separate premium gate. |
| History | Saves `mode: 'menu'` + menu text + a **frozen snapshot** of results. Does NOT live-re-analyze on view (re-calling Claude costs money). |
| Model | **Haiku** (fast/cheap structured extraction). Cost at 1,000 scans/day ≈ ~$180–350/mo all-in — covered by subscription revenue. |
| Cost controls | Cap menu text (~6,000 chars), prompt-cache the static prefix, count against scan limit. |
| Accessibility | WCAG 2.1 AA (status as text; caveat legible). |

## Architecture & Data Flow

```
photo → POST /scan/menu {imageBase64} → Google Vision OCR ┐
paste → POST /scan/menu {text} ───────────────────────────┴→ menuText (capped)
   → Claude Haiku (structured JSON tool output)  → dishes[] with categories/allergens
   → per-profile mapping (server, existing logic) → { dishes, profiles } → client
```

### New endpoint `POST /scan/menu` (requireAuth, consumes a scan)

Body: `{ imageBase64?: string, text?: string }` (one required).
1. If `imageBase64`: Google Vision `TEXT_DETECTION` → `menuText`. Else `menuText = text`.
2. Trim/normalize; if empty → 422 "No menu text found." Cap `menuText` to 6,000 chars.
3. Read the family's profiles (via `getProfiles`) to build the concern set:
   the canonical **category keys + labels/descriptions** (from `categories.js`) plus
   the **union of custom allergen names** across all profiles.
4. Call Claude (see below) → `dishes[]`.
5. **Per-profile mapping** (pure `mapMenuToProfiles`): for each profile, each dish is
   `flagged` if `dish.categories ∩ profile.activeCategories` OR `dish.allergens`
   matches one of that profile's allergen names. Returns per-profile counts +
   per-dish per-profile status.
6. `tryConsumeScan(uid)` (after a successful analysis); return the result.

### Claude integration (`server/utils/menuAnalyzer.js`)

- **Model:** `claude-haiku-4-5`. Uses the Anthropic SDK; `ANTHROPIC_API_KEY` from env.
- **Structured output** via a single tool (`report_menu`) whose input schema is:
  ```
  { dishes: [ { name: string, categories: string[], allergens: string[], note: string } ] }
  ```
  where `categories[]` are canonical category keys and `allergens[]` are drawn from
  the provided custom-allergen list. Tool use forces valid JSON.
- **Prompt caching:** the static system prompt (instructions + category
  definitions) is marked `cache_control` so it's cached across scans; only the menu
  text + the (small) allergen list vary.
- **Prompt intent:** "You read restaurant menus. For each dish, list the concern
  categories it LIKELY contains given typical preparation, and any of these specific
  allergens it likely contains. Be conservative but flag likely hidden ingredients
  (e.g. Alfredo → dairy; breaded → gluten). Do not guarantee safety." Static prefix
  cached.
- **Robustness:** wrap parsing; if Claude returns no dishes → result with empty
  `dishes` and a "couldn't identify dishes" flag; on API error → 502 with a friendly
  message; the menu-text cap bounds cost/latency.

### Response shape
```js
{
  type: 'menu',
  menuText,
  dishes: [
    { name, note,
      categories: [<key>], categoryLabels: [<label>],
      allergens: [<name>],
      perProfile: [ { profileId, name, flagged: boolean } ] }
  ],
  profiles: [ { profileId, name, flaggedCount } ]
}
```

## Client

- **`web/src/api.js`:** `scanMenu({ imageBase64, text })` → `POST /scan/menu`.
- **`ScanScreen.jsx`:** add a **Menu** mode to the Label/Barcode toggle. Menu mode:
  camera capture → `scanMenu({ imageBase64 })`; a **"Paste menu text instead"** link
  opens a textarea sheet → `scanMenu({ text })`. Consumes a scan; `scan_limit_reached`
  → `/upgrade` (existing behavior).
- **`web/src/MenuResultsScreen.jsx` + CSS:** renders the menu result:
  - **Caveat banner** (prominent, always visible): *"Menus don't list full
    ingredients. These are AI estimates of what dishes likely contain — always
    confirm with your server. Not a safety guarantee."*
  - **Per-profile chips** (reused pattern): "Emma — 4 to avoid / Liam — 6." Selecting
    a child sets the lens.
  - For the selected child: **"Avoid / check"** dishes (each with "likely
    [Category · Category]" chips + Claude's short note) and a calmer **"Looks OK"**
    list. Wording is always "likely."
  - Solo family → single verdict (no chips), consistent with other results.
- **Routing/handleResult:** menu scans flow through the same `handleResult` →
  navigate to the menu results view; `mode: 'menu'` saved to history with a snapshot
  (see History).

## History

- Menu scans save to `users/{uid}/scans/{id}` with `mode: 'menu'`, `menuText`, and a
  `menuSnapshot` (the `dishes`/`profiles` result). `productName` = null.
- **History detail for a menu scan renders the stored snapshot** — it does NOT call
  `/scan/rematch` (that's for ingredient text; menu re-analysis would re-bill Claude).
- History list `FlagBadge` shows the count of dishes flagged (for the primary/first
  profile) from the snapshot.

## Testing

- **Server (unit, `node --test`):**
  - `mapMenuToProfiles(dishes, profiles)` — dish with `dairy` → flagged for a
    dairy-active profile, safe for a dyes-only profile; allergen-name match;
    per-profile counts; empty dishes.
  - The concern-set builder (categories + union of allergen names).
  - Parsing/validation of Claude's tool output against sample payloads (valid,
    empty, unknown-category filtered out).
  - Claude + Vision calls are integration/manual (the Anthropic call can be mocked;
    do not hit the live API in unit tests).
- **Client (manual):** menu photo + paste flows; result view (chips, Avoid/Looks-OK,
  caveat banner); solo vs multi profile; `scan_limit_reached` → upgrade; accessibility
  pass (status as text, caveat legible, keyboard).

## What Does Not Change

- System 1–4 internals; the category system and per-profile logic are reused, not
  modified.
- Barcode + label scanning; billing/scan-limit mechanics (menu just consumes a scan).

## Out of Scope (later / YAGNI)

- The Terms-of-Service acceptance gate (separate backlog item; must cover
  "not a guarantee / AI can err").
- Live re-analysis of saved menu scans (snapshot only).
- Keyword/lexicon menu matching (Claude replaces it).
- Saving individual dishes to Lists / substitutes for flagged dishes.
- Heavy multi-language menu support (Claude handles common cases incidentally).
