# UI Redesign 3B — Profiles & Lists Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Profiles & Lists screens (`ProfilesScreen`, `ProfileEditor`, `ListsScreen`, `ListDetailScreen`) onto the shared `.ui-*` patterns and remove their hardcoded colors.

**Architecture:** Add a shared `.ui-input` to `patterns.css`. Adopt `.ui-card` on rows/items, `.ui-pill` on preset/filter chips, tokenized danger on delete buttons, and replace all hardcoded hex with tokens. Visual only — no logic/data changes.

**Tech Stack:** React (Vite ESM), CSS tokens.

**Spec:** `docs/superpowers/specs/2026-08-20-ui-redesign-3b-profiles-lists-design.md`

## Global Constraints

- **Node 20** — prefix `node`/`npx` with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Tokens only** — no hardcoded hex (allow `var(--white)`); use `--surface`/`--border`/`--sage`/`--danger`/`--muted`/`--radius`/`--radius-sm`/`--radius-full`.
- **Reuse Batch A patterns** (`patterns.css` `.ui-*`); add only `.ui-input`.
- **Scope:** the four screens' bodies. No logic/data/routing changes; other batches untouched.
- **Deploy:** frontend-only, no rules change.

---

## Task 1: Add `.ui-input` to `patterns.css`

**Files:** Modify `web/src/patterns.css`

- [ ] **Step 1: Append the input pattern**

Add to the end of `web/src/patterns.css`:
```css
.ui-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
.ui-input:focus-visible { outline: 2px solid var(--sage); outline-offset: 1px; }
```

- [ ] **Step 2: Build**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/patterns.css
git commit -m "feat(ui): add shared .ui-input pattern"
```

---

## Task 2: Restyle Profiles family

**Files:**
- Modify: `web/src/ProfilesScreen.jsx`, `web/src/ProfileEditor.jsx`, `web/src/ProfilesScreen.css`

- [ ] **Step 1: Adopt shared classes in the JSX**

In `web/src/ProfilesScreen.jsx`:
- `<button ... className="profile-row" ...>` → `className="ui-card profile-row"`.

In `web/src/ProfileEditor.jsx`:
- Preset chips: `<button key={p.key} className="pe-preset" ...>` → `className="ui-pill ui-pill-neutral pe-preset"`.
- Name input: `<input id="pe-name" className="allergen-input" ...>` → `className="ui-input"`.
- Delete: `<button className="pe-delete" ...>` → `className="ui-btn pe-delete"`.

- [ ] **Step 2: Tokenize `ProfilesScreen.css` (hardcoded hex → tokens)**

Run these deterministic replacements:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/var\(--sage,#3a7\)/var(--sage)/g; s/var\(--border,var\(--border\)\)/var(--border)/g; s/var\(--ink-2\)/var(--muted)/g' ProfilesScreen.css
sed -i '' -E 's/background:#fff/background:var(--surface)/g; s/background: #fff/background: var(--surface)/g' ProfilesScreen.css
sed -i '' -E 's/border:1px solid #fecaca/border:1px solid var(--danger)/g; s/1px solid #E7B7B3/1px solid var(--danger)/g' ProfilesScreen.css
```

- [ ] **Step 3: Simplify `.profile-row`, `.pe-preset`, `.pe-delete` to layer on the shared classes**

In `web/src/ProfilesScreen.css`:

Replace `.profile-row` (it now sits on `.ui-card`, so drop the duplicated surface/border/radius/padding; keep layout):
```css
.profile-row { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%;
  text-align:left; background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:14px 16px; margin-bottom:10px; cursor:pointer; }
```
→
```css
.profile-row { flex-direction:column; align-items:flex-start; gap:2px; text-align:left; margin-bottom:10px; cursor:pointer; }
```

Replace `.pe-preset` (now on `.ui-pill`, drop shape/bg):
```css
.pe-preset { padding:8px 12px; border:1px solid var(--border); border-radius:999px;
  background:var(--surface); font-size:14px; cursor:pointer; }
```
→
```css
.pe-preset { cursor:pointer; }
```

Replace `.pe-delete` (now `.ui-btn`; keep spacing + danger accent, base from ui-btn):
```css
.pe-delete { margin-top:28px; width:100%; padding:12px; border:1px solid var(--danger); color:var(--danger);
  background:var(--surface); border-radius:10px; cursor:pointer; }
```
→
```css
.pe-delete { margin-top:28px; width:100%; border:1px solid var(--danger); color:var(--danger); background:var(--surface); }
```

- [ ] **Step 4: Build + no-hex check**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web
grep -nE "#[0-9a-fA-F]{3,6}" src/ProfilesScreen.css && echo "HEX REMAINS" || echo "profiles css tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `profiles css tokenized`; build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/ProfilesScreen.jsx web/src/ProfileEditor.jsx web/src/ProfilesScreen.css
git commit -m "feat(ui): restyle Profiles + editor onto shared patterns + tokens"
```

---

## Task 3: Restyle Lists family

**Files:**
- Modify: `web/src/ListsScreen.jsx`, `web/src/ListsScreen.css`

- [ ] **Step 1: Adopt shared classes in the JSX**

In `web/src/ListsScreen.jsx`:
- `<button key={l.id} className="list-row" ...>` → `className="ui-card list-row"`.
- `<button className="lists-new-btn" onClick={create} ...>` (both occurrences — the Lists "Create" and the ListDetail "Add") → `className="ui-btn ui-btn-primary lists-new-btn"`.
- Leave `<input className="ld-name" ...>` **unchanged** — it's an inline editable title, kept flush (not a boxed `.ui-input`).
- Filter buttons: `<button ... className={...ld-filter-btn...}>` — add `ui-pill`: change the className expression to include `ui-pill` (keep `ld-filter-btn` + the active modifier). (There are three filter buttons via a map or inline; add `ui-pill ` to each `ld-filter-btn` occurrence.)
- Item rows: both `<div key={it.id} className="ld-item">` → `className="ui-card ld-item"`.
- Delete: `<button className="ld-delete" ...>` → `className="ui-btn ld-delete"`.

- [ ] **Step 2: Tokenize `ListsScreen.css`**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web/src
sed -i '' -E 's/var\(--sage, #3a7\)/var(--sage)/g; s/var\(--border, var\(--border\)\)/var(--border)/g' ListsScreen.css
sed -i '' -E 's/background: #fff/background: var(--surface)/g; s/background:#fff/background:var(--surface)/g' ListsScreen.css
sed -i '' -E 's/1px solid #fecaca/1px solid var(--danger)/g' ListsScreen.css
```

- [ ] **Step 3: Simplify `.list-row`, `.ld-item`, `.ld-filter-btn`, `.ld-name`, `.ld-delete`**

In `web/src/ListsScreen.css`:

`.list-row` — now on `.ui-card`, drop the surface/border/radius (keep layout + margin). Change:
```css
.list-row { display: flex; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--border);
```
(and its continuation) → a layout-only rule:
```css
.list-row { display: flex; width: 100%; text-align: left; margin-bottom: 10px; cursor: pointer; }
```
(Remove the old border/radius/padding continuation lines for `.list-row`.)

`.ld-item` — convert from bordered list row to card: change
```css
.ld-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
```
→
```css
.ld-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
```

`.ld-filter-btn` — now on `.ui-pill`, drop shape/bg; keep as a togglable pill:
```css
.ld-filter-btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 13px; cursor: pointer; }
```
→
```css
.ld-filter-btn { border: 1px solid var(--border); background: var(--surface); cursor: pointer; }
```
Keep `.ld-filter-on { border-color: var(--sage); color: var(--sage); font-weight: 700; }` (already tokenized).

`.ld-name` — leave unchanged (intentional inline editable title; already token-based).

`.ld-delete` — now `.ui-btn`; keep danger accent:
```css
.ld-delete { margin-top: 28px; width: 100%; padding: 12px; border: 1px solid var(--danger); color: var(--danger); background: var(--surface); border-radius: 10px; cursor: pointer; }
```
→
```css
.ld-delete { margin-top: 28px; width: 100%; border: 1px solid var(--danger); color: var(--danger); background: var(--surface); }
```

- [ ] **Step 4: Build + no-hex check**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web
grep -nE "#[0-9a-fA-F]{3,6}" src/ListsScreen.css && echo "HEX REMAINS" || echo "lists css tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: `lists css tokenized`; build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/ListsScreen.jsx web/src/ListsScreen.css
git commit -m "feat(ui): restyle Lists + list detail onto shared patterns + tokens"
```

---

## Task 4: Full verification

- [ ] **Step 1: Build + tests + no-hex across both files**

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/homeModel.test.js src/headerModel.test.js src/resultsModel.test.js src/legal.test.js 2>&1 | grep -E "# tests|# pass|# fail"
grep -nE "#[0-9a-fA-F]{3,6}" src/ProfilesScreen.css src/ListsScreen.css && echo "HEX REMAINS" || echo "tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: tests pass; `tokenized`; build succeeds.

- [ ] **Step 2: Manual (signed-in)**

- Profiles list: rows are `.ui-card`s; tap → editor. Editor: preset chips are pills, category switches toggle (On/Off text + `--sage-light` on-state), name input styled, "Delete profile" reads as a danger button.
- Lists index: rows are cards; "New list" input + create button styled; create works.
- List detail: filter pills toggle (All/Safe/Has-flags), item rows are cards with thumbnails, remove/delete work, inline list-name title still editable.
- All read as one system with Home/Results.

- [ ] **Step 3: Accessibility (manual + axe)**

- Cards/rows are focusable buttons; pills text-labeled; switch state as text; danger buttons labeled; input focus visible; contrast AA.

- [ ] **Step 4: Deploy note**

Frontend-only, no rules change — normal push. Remaining: Batch C (History/Support/Upgrade), D (Login/Legal/gate); OFF-photo bug still deferred.

---

## Self-Review

**Spec coverage:** rows→ui-card (Tasks 2,3) ✓; preset/filter chips→ui-pill (Tasks 2,3) ✓; buttons→ui-btn incl. danger delete (Tasks 2,3) ✓; switches kept + tokenized (Task 2) ✓; `.ui-input` added + applied to name/create (Tasks 1,2,3) ✓; all hex tokenized w/ grep gate (Tasks 2,3,4) ✓; WCAG (focus/pill text/switch text/contrast) (Task 4) ✓.

**Placeholder scan:** No TBD. Step 3 of Task 3 explicitly corrects the `.ld-name` handling (leave inline title unchanged) so there's one final instruction, not a placeholder.

**Type consistency:** All changes are class/token swaps against verified current markup (`profile-row`, `pe-preset`, `pe-delete`, `list-row`, `ld-item`, `ld-filter-btn`, `ld-delete`, `lists-new-btn`, `allergen-input`→`ui-input`). `.ui-card`/`.ui-pill`/`.ui-btn`/`.ui-input` are the Batch A + Task 1 classes. No logic touched.
