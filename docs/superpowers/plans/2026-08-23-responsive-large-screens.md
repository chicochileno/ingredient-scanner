# Responsive / Large Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On screens wider than the phone frame, present the app as a centered ~640px column over a muted backdrop (no fake-phone/device chrome), and let the Home Scan History grid use the extra width — with zero change to the phone layout.

**Architecture:** Pure CSS. Cap `.app-shell` at `max-width: 640px` and center it with `margin: 0 auto` (keeping `position: fixed; inset: 0`, so `left/right: 0` + `margin: auto` centers it and `top/bottom: 0` keeps full height). Add a muted `--backdrop` token painted on `html, body` (behind the frame; invisible on phones since the app fills the viewport) and a soft edge-shadow on the shell to separate it from the backdrop. Switch the Home history grid to `auto-fill` columns so it flows from 2 columns on a phone to 3 in the frame.

**Tech Stack:** React + Vite, plain CSS with design tokens. Node 20 (`~/.nvm/versions/node/v20.20.2/bin`) for the web build.

## Global Constraints

- Phone layout (< 640px viewport) must look and behave **identically** to today — the centering, backdrop, and shadow only take visual effect above 640px.
- No JS, routing, or component changes. CSS only, in the three named files.
- Use design tokens; add the one new token (`--backdrop`) alongside the others in `index.css`. No hardcoded hex outside the `:root` token block.
- Web build (`vite build`) must be clean.
- Build/tests run on Node 20: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.

---

### Task 1: Center the app shell at 640px over a muted backdrop

**Files:**
- Modify: `web/src/index.css:3-32` (add `--backdrop` token), `web/src/index.css:40-46` (paint backdrop on `body`)
- Modify: `web/src/AppShell.css:1-7` (`.app-shell` max-width + center + shadow)

**Interfaces:**
- Consumes: existing `:root` tokens, existing `.app-shell { position: fixed; inset: 0; ... }`.
- Produces: `--backdrop` token; a `.app-shell` that is full-bleed under 640px and a centered 640px column above it.

- [ ] **Step 1: Add the `--backdrop` token**

In `web/src/index.css`, inside the `:root` block, add after the `--border` line (line 11):

```css
  --backdrop: #DDE0D2;
```

(A muted, desaturated sage-gray — slightly darker/greyer than `--bg` `#F3F5EC`, so the app column reads as the focus.)

- [ ] **Step 2: Paint the backdrop behind the frame**

In `web/src/index.css`, change the `body` background (line 42) from:

```css
  background: var(--bg);
```

to:

```css
  background: var(--backdrop);
```

(On phones the `.app-shell` fills the viewport and covers this entirely; it only shows in the margins on wider screens.)

- [ ] **Step 3: Cap and center the shell, add the edge-shadow**

In `web/src/AppShell.css`, replace the `.app-shell` rule (lines 1-7):

```css
.app-shell {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
```

with:

```css
.app-shell {
  position: fixed;
  inset: 0;
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  box-shadow: 0 0 48px rgba(23, 32, 26, 0.18);
}
```

(`inset: 0` gives `left/right: 0` so `margin: 0 auto` centers the capped-width column; `top/bottom: 0` keeps full height. On phones the shadow sits at the screen edges and is not visible; on wide screens it separates the column from the backdrop. No rounded corners — not a device frame.)

- [ ] **Step 4: Build to verify it compiles**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && cd web && npm run build
```
Expected: build completes with no errors.

- [ ] **Step 5: Manual visual check (desktop + phone widths)**

Run the dev server (`export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && cd web && npm run dev`) and, in a browser:
- At a wide window: the app is a centered 640px column on the muted backdrop with a soft edge-shadow; the header and bottom nav span the 640px frame (not the whole window); no rounded/phone chrome.
- Narrow the window below 640px (or device-emulate a phone): the app is full-bleed exactly as before — no visible backdrop, no side shadow, header/nav span the full width.

- [ ] **Step 6: Commit**

```bash
git add web/src/index.css web/src/AppShell.css
git commit -m "feat(responsive): center app at 640px over muted backdrop on large screens"
```

---

### Task 2: Let the Home history grid breathe on the wider frame

**Files:**
- Modify: `web/src/HomeScreen.css:33` (`.home-history-grid` columns)

**Interfaces:**
- Consumes: the centered 640px frame from Task 1.
- Produces: a Home Scan History grid that flows 2 columns on a phone → 3 on the frame.

- [ ] **Step 1: Switch the grid to auto-fill columns**

In `web/src/HomeScreen.css`, change `.home-history-grid` (line 33) from:

```css
.home-history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
```

to:

```css
.home-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
```

(At a ~360px phone width this yields 2 columns as before; inside the 640px frame it yields 3.)

- [ ] **Step 2: Build to verify it compiles**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && cd web && npm run build
```
Expected: build completes with no errors.

- [ ] **Step 3: Manual visual check**

In the running app on the Home screen:
- Wide window (640px frame): Scan History shows **3** cards per row, evenly sized, gaps intact.
- Phone width: Scan History shows **2** cards per row exactly as before.

- [ ] **Step 4: Commit**

```bash
git add web/src/HomeScreen.css
git commit -m "feat(responsive): Home history grid flows 2->3 columns on wider frame"
```

---

## Self-Review

- **Spec coverage:** `.app-shell` cap+center+shadow (Task 1), `--backdrop` token + body backdrop (Task 1), Home grid auto-fill (Task 2), phones unchanged (Global Constraints + both manual checks). All spec architecture bullets covered.
- **Placeholder scan:** none — every step has concrete code and exact commands.
- **Type/name consistency:** token name `--backdrop` used consistently across index.css add + body reference; class names `.app-shell` / `.home-history-grid` match the current files verbatim.
