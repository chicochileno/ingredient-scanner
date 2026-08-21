# UI Redesign 3A — Scan Output Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reusable `.ui-*` pattern layer (cards, pills, buttons, section titles, preview boxes), and restyle `ResultsScreen` + `MenuResultsScreen` onto it — including the Home-style dark-gray/contain preview on the Results product photo and a tokenization pass over MenuResults' hardcoded colors.

**Architecture:** A new `patterns.css` (imported once) defines token-based `.ui-*` classes. A pure `severityPill(flag)` helper maps a flag to `{variant,label}`. Results and MenuResults adopt the shared classes; MenuResults' hardcoded reds/greens become tokens. Visual only — no logic/data changes.

**Tech Stack:** React (Vite ESM), CSS custom properties, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-20-ui-redesign-3a-scan-output-design.md`

## Global Constraints

- **Node 20** — prefix `node`/`npm`/`npx` with `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **Tokens only** — no new hardcoded colors; use `--surface`/`--border`/`--radius`/`--shadow`/`--sage`/`--safe`/`--warning`/`--danger`/`--preview-bg` and their `-light` variants.
- **Pills stay text-labeled** (never color-only); ≥44px button targets; visible focus.
- **Scope:** Results + MenuResults bodies + the shared pattern layer. No logic/data/routing changes. Other screens (batches B/C/D) untouched.
- **Judged deviation from spec (intentional):** Results keeps its existing uppercase `.section-title` group labels (they already work well as fine-grained group headers); `.ui-section-title` (display font) is used on MenuResults' section headings. Noted so it's a decision, not an oversight.
- **Deploy:** frontend-only, no rules change; normal push to `main`.

---

## Task 1: Shared `patterns.css` + `severityPill` helper

**Files:**
- Create: `web/src/patterns.css`
- Modify: `web/src/main.jsx` (import it once)
- Create: `web/src/resultsModel.js`, `web/src/resultsModel.test.js`

**Interfaces:**
- Produces: the `.ui-*` classes; `severityPill(flag) -> { variant, label }` with `variant` ∈ `'safe'|'warning'|'danger'|'neutral'`.

- [ ] **Step 1: Write the failing `severityPill` test**

Create `web/src/resultsModel.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { severityPill } from './resultsModel.js';

test('possible tier → warning / Worth checking', () => {
  assert.deepStrictEqual(severityPill({ tier: 'possible', severity: 'high' }), { variant: 'warning', label: 'Worth checking' });
});
test('high severity → danger / High concern', () => {
  assert.deepStrictEqual(severityPill({ severity: 'high' }), { variant: 'danger', label: 'High concern' });
});
test('moderate severity → warning / Moderate concern', () => {
  assert.deepStrictEqual(severityPill({ severity: 'moderate' }), { variant: 'warning', label: 'Moderate concern' });
});
test('anything else → neutral / Flagged', () => {
  assert.deepStrictEqual(severityPill({}), { variant: 'neutral', label: 'Flagged' });
  assert.deepStrictEqual(severityPill({ severity: 'low' }), { variant: 'neutral', label: 'Flagged' });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/resultsModel.test.js`
Expected: FAIL — `Cannot find module './resultsModel.js'`.

- [ ] **Step 3: Implement `resultsModel.js`**

Create `web/src/resultsModel.js`:
```js
// Pure: map a flag to a status-pill descriptor. No IO.
export function severityPill(flag = {}) {
  if (flag.tier === 'possible') return { variant: 'warning', label: 'Worth checking' };
  if (flag.severity === 'high') return { variant: 'danger', label: 'High concern' };
  if (flag.severity === 'moderate') return { variant: 'warning', label: 'Moderate concern' };
  return { variant: 'neutral', label: 'Flagged' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/resultsModel.test.js`
Expected: PASS.

- [ ] **Step 5: Create `patterns.css`**

Create `web/src/patterns.css`:
```css
/* Reusable body patterns on the design tokens. Adopted across restyle batches. */

.ui-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
}

.ui-section-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 10px;
  color: var(--ink);
}

.ui-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.ui-pill-safe { background: var(--safe-light); color: var(--safe); }
.ui-pill-warning { background: var(--warning-light); color: var(--warning); }
.ui-pill-danger { background: var(--danger-light); color: var(--danger); }
.ui-pill-neutral { background: var(--sage-light); color: var(--sage-deep); }

.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 12px 18px;
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.ui-btn:focus-visible { outline: 2px solid var(--sage-deep); outline-offset: 2px; }
.ui-btn-primary { background: var(--sage); color: #fff; }
.ui-btn-secondary { background: var(--surface); color: var(--ink); border-color: var(--border); }

.ui-preview {
  position: relative;
  width: 100%;
  height: 180px;
  max-height: 180px;
  background: var(--preview-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  overflow: hidden;
}
.ui-preview img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
```

- [ ] **Step 6: Import `patterns.css` globally**

In `web/src/main.jsx`, after `import './index.css'`, add:
```jsx
import './patterns.css'
```

- [ ] **Step 7: Build + tests pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/resultsModel.test.js 2>&1 | grep -E "# pass|# fail" && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/patterns.css web/src/main.jsx web/src/resultsModel.js web/src/resultsModel.test.js
git commit -m "feat(ui): shared .ui-* pattern layer + severityPill helper"
```

---

## Task 2: Restyle `ResultsScreen`

**Files:**
- Modify: `web/src/ResultsScreen.jsx`
- Modify: `web/src/ResultsScreen.css`

- [ ] **Step 1: Route the severity badge through `severityPill` + `.ui-pill`**

In `web/src/ResultsScreen.jsx`, add the import (near the other imports):
```jsx
import { severityPill } from './resultsModel';
```
Replace the `SeverityBadge` component:
```jsx
function SeverityBadge({ tier, severity }) {
  if (tier === 'possible') {
    return <span className="flag-severity flag-severity-possible">Worth checking</span>;
  }
  return (
    <span className={`flag-severity flag-severity-${severity}`}>
      {severity === 'high' ? 'High concern' : 'Moderate concern'}
    </span>
  );
}
```
with:
```jsx
function SeverityBadge({ tier, severity }) {
  const { variant, label } = severityPill({ tier, severity });
  return <span className={`ui-pill ui-pill-${variant}`}>{label}</span>;
}
```

- [ ] **Step 2: Cards → `.ui-card` base (keep accent variants)**

In `web/src/ResultsScreen.jsx`, change the card wrapper in `IngredientCard`:
```jsx
    <div className={`card ${cardClass}`} style={{ animationDelay: `${index * 60}ms` }}>
```
to:
```jsx
    <div className={`ui-card card ${cardClass}`} style={{ animationDelay: `${index * 60}ms` }}>
```
(Keeping `card`/`card-<variant>` for the left-accent + animation; `ui-card` provides the shared base.)

In `web/src/ResultsScreen.css`, change the `.card` base rule so it no longer duplicates the surface/border/shadow (now from `.ui-card`) but keeps the accent + animation:
```css
.card {
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 16px;
  border-left: 3px solid transparent;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  animation: fadeUp 0.4s ease both;
}
```
→
```css
.card {
  width: 100%;
  border-left: 3px solid transparent;
  animation: fadeUp 0.4s ease both;
}
```
And update the variant accents to set the full left border (since `.ui-card` has a 1px all-round border):
```css
.card-high { border-left: 3px solid var(--danger); }
.card-moderate { border-left: 3px solid var(--warning); }
.card-possible { border-left: 3px solid var(--sage); }
```
(Replace the existing `.card-high`, `.card-moderate`, `.card-possible` rule bodies with these; drop their redundant `background: var(--surface);`.)

- [ ] **Step 3: Product photo → `.ui-preview`**

In `web/src/ResultsScreen.jsx`, change:
```jsx
        {imageUrl && <div className="results-photo-wrap"><img src={imageUrl} alt="Scanned item" className="results-photo" /></div>}
```
to:
```jsx
        {imageUrl && <div className="ui-preview results-preview"><img src={imageUrl} alt="Scanned item" /></div>}
```
In `web/src/ResultsScreen.css`, replace the `.results-photo-wrap` and `.results-photo` rules with a small spacing rule:
```css
.results-preview { margin-bottom: 20px; }
```
(Delete the old `.results-photo-wrap` and `.results-photo` blocks.)

- [ ] **Step 4: Footer buttons → `.ui-btn`**

In `web/src/ResultsScreen.jsx`, change the footer buttons:
```jsx
        <button className="save-list-btn" onClick={() => setShowSave(true)}>Save to list</button>
        <button className="scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
```
to:
```jsx
        <button className="ui-btn ui-btn-secondary save-list-btn" onClick={() => setShowSave(true)}>Save to list</button>
        <button className="ui-btn ui-btn-primary scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
```
In `web/src/ResultsScreen.css`, keep only the flex sizing for these (the visual comes from `.ui-btn*`). Ensure these rules exist (add if missing, replacing any full-styling versions):
```css
.results-footer .save-list-btn { flex: 1; }
.results-footer .scan-again-btn { flex: 1; width: auto; }
```
(Remove the old full `.scan-again-btn { ... }` / `.save-list-btn { ... }` visual rules; the `.results-footer .*` flex rules stay.)

- [ ] **Step 5: Build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/ResultsScreen.jsx web/src/ResultsScreen.css
git commit -m "feat(ui): restyle Results onto shared patterns (ui-card/ui-pill/ui-preview/ui-btn)"
```

---

## Task 3: Restyle `MenuResultsScreen` (tokenize + adopt patterns)

**Files:**
- Modify: `web/src/MenuResultsScreen.jsx`
- Modify: `web/src/MenuResultsScreen.css`

- [ ] **Step 1: Adopt shared classes in the JSX**

In `web/src/MenuResultsScreen.jsx`:
- Section headings: change both `<h2 className="menu-section-title menu-section-avoid">` and `<h2 className="menu-section-title menu-section-ok">` to add `ui-section-title` (keep the `menu-section-avoid`/`-ok` modifier for the status color): e.g. `className="ui-section-title menu-section-title menu-section-avoid"`.
- Dish rows: change `<div className="menu-dish menu-dish-avoid">` / `menu-dish-ok` to `className="ui-card menu-dish menu-dish-avoid"` (and `-ok`).
- Category chips: change `<span className="menu-chip">likely {label}</span>` to `<span className="ui-pill ui-pill-warning menu-chip">likely {label}</span>`.
- Footer button: change `<button className="scan-again-btn" ...>` to `<button className="ui-btn ui-btn-primary" ...>`.
- Per-child chips: leave the `profile-chip` classes (styled in CSS below).

- [ ] **Step 2: Tokenize `MenuResultsScreen.css`**

Replace `web/src/MenuResultsScreen.css` entirely with (hardcoded colors → tokens; dish base now from `.ui-card`, so keep only accents/layout):
```css
.menu-results-root { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
.menu-results-scroll { flex: 1; overflow-y: auto; padding: 16px; }
.menu-caveat {
  background: var(--warning-light);
  border: 1px solid var(--warning);
  color: var(--warning);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 0.95rem;
  line-height: 1.4;
  margin-bottom: 16px;
}
.menu-empty { color: var(--muted); }
.profile-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.profile-chip { padding: 8px 12px; border-radius: var(--radius-full); border: 1px solid var(--border); background: var(--surface); cursor: pointer; font-size: 0.9rem; color: var(--ink); }
.profile-chip-flagged { border-color: var(--danger); }
.profile-chip-safe { border-color: var(--safe); }
.profile-chip-sel { background: var(--sage); color: var(--white); border-color: var(--sage); }
.menu-section { margin-bottom: 20px; }
.menu-section-title { font-size: 1.05rem; margin: 0 0 10px; }
.menu-section-avoid { color: var(--danger); }
.menu-section-ok { color: var(--safe); }
.menu-dishes { display: flex; flex-direction: column; gap: 10px; }
.menu-dish { border-left: 3px solid transparent; }
.menu-dish-avoid { border-left-color: var(--danger); }
.menu-dish-ok { border-left-color: var(--safe); }
.menu-dish-name { font-weight: 600; }
.menu-dish-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.menu-dish-allergens { margin-top: 8px; font-size: 0.85rem; color: var(--warning); }
.menu-dish-note { margin: 8px 0 0; font-size: 0.88rem; color: var(--muted); }
.menu-results-footer { padding: 12px 16px; border-top: 1px solid var(--border); }
.menu-results-footer .ui-btn { width: 100%; }
```

- [ ] **Step 3: Build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build 2>&1 | grep -E "built in|error" | head`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/MenuResultsScreen.jsx web/src/MenuResultsScreen.css
git commit -m "feat(ui): restyle Menu Results onto tokens + shared patterns"
```

---

## Task 4: Full verification

- [ ] **Step 1: Unit tests + build + no hardcoded colors left in MenuResults**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web
node --test src/resultsModel.test.js src/headerModel.test.js src/homeModel.test.js 2>&1 | grep -E "# tests|# pass|# fail"
grep -nE "#[0-9a-fA-F]{3,6}" src/MenuResultsScreen.css && echo "HARDCODED HEX REMAINS" || echo "menu css tokenized"
npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: tests pass; `menu css tokenized`; build succeeds.

- [ ] **Step 2: Manual flow (signed-in)**

- Do a **label scan** with flags → Results shows `.ui-card` flag cards with `.ui-pill` severity badges (High/Moderate/Worth-checking colors correct); "No flags found" banner reads clean; footer shows a sage primary + outline secondary button.
- Do a scan with a product image (or a barcode once the OFF fix lands) → the product photo shows in the dark-gray **contain** preview, capped height, consistent with Home.
- Do a **menu scan** → per-child chips, "Avoid / check" (danger) + "Looks OK" (safe) dish cards with left accents, "likely …" category pills, caveat banner on warning tokens, sage primary footer.
- Dismiss a flag and switch profile chips → still work.
- Both screens visually match Home/each other (one system).

- [ ] **Step 3: Accessibility (manual + axe)**

- Pills are text-labeled; `--danger/--warning/--safe` on `-light` pass AA; buttons have visible focus + ≥44px; preview images have `alt`.

- [ ] **Step 4: Deploy note**

Frontend-only, no rules change — normal push to `main`. Remaining batches (B/C/D) still old-styled; the OFF-image bug is still deferred (its fix will now be visible in the restyled Results preview).

---

## Self-Review

**Spec coverage:**
- Shared `.ui-*` pattern layer (card/pill/button/section-title/preview) imported globally — Task 1 ✓
- `severityPill` pure helper, unit-tested — Task 1 ✓
- Results: cards→ui-card, severity→severityPill+ui-pill, photo→ui-preview, footer→ui-btn — Task 2 ✓
- MenuResults: tokenized (hardcoded colors removed), chips/dishes/headings/footer onto patterns — Task 3 ✓
- Preview treatment on Results photo (contain/dark-gray/capped) — Task 2 ✓
- WCAG AA (pill text, contrast, focus, alts) — Tasks 1–3, 4 ✓
- Judged deviation (Results keeps uppercase `.section-title`) documented — Global Constraints ✓

**Placeholder scan:** No TBD/TODO; each edit shows exact before/after against verified current markup (`SeverityBadge`, `.card`/variants, `results-photo-wrap`, footer buttons, menu dish/chip/caveat markup).

**Type consistency:** `severityPill(flag) -> {variant,label}` (Task 1) consumed exactly in `SeverityBadge` (Task 2) as `ui-pill-${variant}`. `.ui-preview`/`.ui-card`/`.ui-pill-*`/`.ui-btn*` defined in Task 1 are the classes applied in Tasks 2–3. MenuResults `.ui-btn` footer width rule matches the `ui-btn ui-btn-primary` class applied in Task 3 Step 1.
