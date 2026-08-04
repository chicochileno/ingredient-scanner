# Terms Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A version-based Terms acceptance gate shown between sign-in and the app — with an explicit checkbox, a liability disclaimer (results are informational only / not a guarantee / AI can err), and public `/terms` + `/privacy` pages — so all users (new and existing) accept once, and re-accept if the terms change.

**Architecture:** A pure predicate + a Firestore-backed `useLegal` hook decide whether to render a `<TermsGate>` in place of the app's routes. Acceptance is stored at `users/{uid}/legal/acceptance` as `{ acceptedVersion, acceptedAt }` and compared against a code constant `CURRENT_TERMS_VERSION`. Two public route components render a starter Terms of Service and a Privacy Policy placeholder.

**Tech Stack:** React (Vite, `web/` is `"type":"module"` ESM), Firebase Auth + Firestore (`onSnapshot`/`setDoc`), `node --test` for the one pure unit test.

**Spec:** `docs/superpowers/specs/2026-08-03-terms-gate-design.md`

## Global Constraints

- **Node 20 required** for build/test — the PATH `node` is v12. Prefix every `node`/`npm`/`npx` command with: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- **WCAG 2.1 AA** — the gate is an accessible dialog (labelled, focus-managed, keyboard-operable, AA contrast, visible focus); legal pages use semantic heading hierarchy.
- **`firestore.rules` is NOT deployed by CI** — the new `legal` rule **must be manually published** in Firebase Console → Firestore → Rules → Publish at deploy, or the acceptance write fails with permission-denied and the gate can never be satisfied.
- **Deploy = push to `main`** auto-deploys frontend (Firebase Hosting) and backend (Railway).
- **The Terms of Service copy is a clearly-labeled non-lawyer starter draft**; the Privacy Policy page is a placeholder for owner-generated content. Keep the DRAFT/PLACEHOLDER banners.
- Storage key is exactly `users/{uid}/legal/acceptance`; the version field is exactly `acceptedVersion` (integer); the constant is exactly `CURRENT_TERMS_VERSION`.

---

## Task 1: Version constant + pure acceptance predicate

**Files:**
- Create: `web/src/legal.js`
- Test: `web/src/legal.test.js`

**Interfaces:**
- Produces: `CURRENT_TERMS_VERSION` (number, `1`) and `needsTermsAcceptance(acceptance, currentVersion) -> boolean`, where `acceptance` is `null` or `{ acceptedVersion?: number, acceptedAt?: any }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/legal.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { needsTermsAcceptance, CURRENT_TERMS_VERSION } from './legal.js';

test('CURRENT_TERMS_VERSION is a positive integer', () => {
  assert.ok(Number.isInteger(CURRENT_TERMS_VERSION) && CURRENT_TERMS_VERSION >= 1);
});

test('needsTermsAcceptance: null/undefined acceptance → true', () => {
  assert.strictEqual(needsTermsAcceptance(null, 1), true);
  assert.strictEqual(needsTermsAcceptance(undefined, 1), true);
});

test('needsTermsAcceptance: acceptance with no version → true', () => {
  assert.strictEqual(needsTermsAcceptance({}, 1), true);
  assert.strictEqual(needsTermsAcceptance({ acceptedAt: 'x' }, 1), true);
});

test('needsTermsAcceptance: older accepted version → true', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 0 }, 1), true);
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 1 }, 2), true);
});

test('needsTermsAcceptance: current or newer version → false', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 1 }, 1), false);
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: 2 }, 1), false);
});

test('needsTermsAcceptance: non-numeric version → true', () => {
  assert.strictEqual(needsTermsAcceptance({ acceptedVersion: '1' }, 1), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/legal.test.js`
Expected: FAIL — `Cannot find module './legal.js'`.

- [ ] **Step 3: Implement `legal.js`**

Create `web/src/legal.js`:
```js
// Single source of truth for the accepted-terms version. Bump this (integer)
// whenever the Terms of Service or Privacy Policy materially change — every
// user will then be re-prompted to accept once.
export const CURRENT_TERMS_VERSION = 1;

// True when the user must (re)accept: no acceptance record, no numeric version,
// or a version older than the current one. Pure — no imports, unit-tested.
export function needsTermsAcceptance(acceptance, currentVersion) {
  if (!acceptance || typeof acceptance.acceptedVersion !== 'number') return true;
  return acceptance.acceptedVersion < currentVersion;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && node --test src/legal.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/legal.js web/src/legal.test.js
git commit -m "feat(legal): terms version constant and needsTermsAcceptance predicate"
```

---

## Task 2: `useLegal` hook

Subscribes to the acceptance doc, mirroring `useBilling`. No unit test (Firestore IO) — verified by build + the manual flow in Task 6.

**Files:**
- Create: `web/src/useLegal.js`

**Interfaces:**
- Consumes: `db` from `./firebase`.
- Produces: `useLegal(user) -> { acceptance: object|null, loading: boolean }`. `acceptance` is the doc data (`{ acceptedVersion, acceptedAt }`) or `null` when there's no doc / no user.

- [ ] **Step 1: Implement the hook**

Create `web/src/useLegal.js`:
```js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Live-loads the user's terms-acceptance record from users/{uid}/legal/acceptance.
// Returns { acceptance, loading }. Fails toward showing the gate (acceptance:null)
// on error, never toward silently skipping it.
export function useLegal(user) {
  const [state, setState] = useState({ acceptance: null, loading: true });

  useEffect(() => {
    if (!user) {
      setState({ acceptance: null, loading: false });
      return;
    }
    const ref = doc(db, 'users', user.uid, 'legal', 'acceptance');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ acceptance: snap.exists() ? snap.data() : null, loading: false }),
      (err) => {
        console.error('Failed to load legal acceptance:', err);
        setState({ acceptance: null, loading: false });
      }
    );
    return unsub;
  }, [user?.uid]);

  return state;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/useLegal.js
git commit -m "feat(legal): useLegal hook subscribing to acceptance doc"
```

---

## Task 3: `TermsGate` component

The blocking dialog: on-screen disclaimers, links to the full docs, a checkbox that enables "Agree & Continue" (which writes the acceptance doc), and a "Sign out" decline path. Accessible dialog with initial focus + Tab trap.

**Files:**
- Create: `web/src/TermsGate.jsx`
- Create: `web/src/TermsGate.css`

**Interfaces:**
- Consumes: `CURRENT_TERMS_VERSION` from `./legal`; `auth`, `db` from `./firebase`.
- Produces: `default export TermsGate({ user })`. On successful accept it writes `users/{uid}/legal/acceptance = { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: serverTimestamp() }`; the parent's `useLegal` snapshot then removes the gate. No `onAccept` prop needed.

- [ ] **Step 1: Implement `TermsGate.jsx`**

Create `web/src/TermsGate.jsx`:
```jsx
import { useState, useRef, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { CURRENT_TERMS_VERSION } from './legal';
import './TermsGate.css';

export default function TermsGate({ user }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);
  const cardRef = useRef(null);

  // Move focus into the dialog on open, and trap Tab within it.
  useEffect(() => {
    if (titleRef.current) titleRef.current.focus();
    const card = cardRef.current;
    if (!card) return;
    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const items = card.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])');
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    card.addEventListener('keydown', onKeyDown);
    return () => card.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleAccept() {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'legal', 'acceptance'),
        { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: serverTimestamp() },
        { merge: true }
      );
      // useLegal's onSnapshot flips the gate off automatically — no navigation needed.
    } catch (e) {
      console.error('Failed to save acceptance:', e);
      setError('Could not save your acceptance. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="terms-gate-overlay">
      <div className="terms-gate-card" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <h1 id="terms-gate-title" className="terms-gate-title" tabIndex={-1} ref={titleRef}>Before you start</h1>
        <p className="terms-gate-intro">Please review and accept how this app works.</p>
        <ul className="terms-gate-points">
          <li>Results are <strong>informational only</strong> and <strong>not a guarantee</strong>.</li>
          <li>Automated/AI analysis can make mistakes — <strong>especially Restaurant Mode menu scans</strong>, which infer <em>likely</em> ingredients from menu wording and can miss ingredients a menu doesn’t list.</li>
          <li>Always <strong>confirm with restaurant staff and product labels</strong>.</li>
          <li>This is <strong>not medical or nutritional advice</strong>. You are responsible for your dietary decisions.</li>
        </ul>
        <p className="terms-gate-links">
          Read the full{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <label className="terms-gate-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {error && <p className="terms-gate-error" role="alert">{error}</p>}
        <button className="terms-gate-accept" onClick={handleAccept} disabled={!checked || saving}>
          {saving ? 'Saving…' : 'Agree & Continue'}
        </button>
        <button className="terms-gate-signout" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `TermsGate.css`**

Create `web/src/TermsGate.css`:
```css
.terms-gate-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg, #f7f5f0);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
  z-index: 100;
}
.terms-gate-card {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border: 1px solid var(--border, #e2ddd3);
  border-radius: 16px;
  padding: 24px;
  box-sizing: border-box;
}
.terms-gate-title { margin: 0 0 8px; font-size: 1.4rem; outline: none; }
.terms-gate-intro { margin: 0 0 16px; color: var(--muted, #555); }
.terms-gate-points { margin: 0 0 16px; padding-left: 20px; line-height: 1.5; }
.terms-gate-points li { margin-bottom: 8px; }
.terms-gate-links { margin: 0 0 16px; }
.terms-gate-links a { color: #2f6b46; text-decoration: underline; }
.terms-gate-checkbox {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 16px;
  cursor: pointer;
}
.terms-gate-checkbox input { margin-top: 3px; width: 18px; height: 18px; flex: none; }
.terms-gate-error { color: #b23b3b; margin: 0 0 12px; }
.terms-gate-accept {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--sage, #4a7c59);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.terms-gate-accept:disabled { opacity: 0.5; cursor: default; }
.terms-gate-signout {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border: none;
  background: none;
  color: var(--muted, #666);
  text-decoration: underline;
  font: inherit;
  cursor: pointer;
}
/* Visible keyboard focus for AA */
.terms-gate-card a:focus-visible,
.terms-gate-card button:focus-visible,
.terms-gate-card input:focus-visible {
  outline: 2px solid #2f6b46;
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/TermsGate.jsx web/src/TermsGate.css
git commit -m "feat(legal): TermsGate acceptance dialog"
```

---

## Task 4: Legal pages (`/terms`, `/privacy`)

Two public page components. `TermsPage` shows a clearly-labeled starter ToS; `PrivacyPage` is a placeholder for owner-generated content. Both use semantic headings and a "Last updated" date.

**Files:**
- Create: `web/src/LegalPages.jsx`
- Create: `web/src/LegalPages.css`

**Interfaces:**
- Produces: named exports `TermsPage` and `PrivacyPage` (each a zero-prop component).

- [ ] **Step 1: Implement `LegalPages.jsx`**

Create `web/src/LegalPages.jsx`:
```jsx
import './LegalPages.css';

const LAST_UPDATED = 'August 3, 2026';
const CONTACT = 'joel.rogers.design@gmail.com';

function LegalLayout({ title, banner, children }) {
  return (
    <div className="legal-root">
      <div className="legal-content">
        <a className="legal-home" href="/">← Back to app</a>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>
        {banner && <p className="legal-banner" role="note">{banner}</p>}
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      banner="DRAFT — this is a plain-language starter, not legal advice. It should be reviewed by a professional before being relied upon."
    >
      <h2>1. Acceptance of these terms</h2>
      <p>By creating an account or using this app, you agree to these Terms of Service and to our Privacy Policy. If you do not agree, do not use the app.</p>

      <h2>2. The service is informational only</h2>
      <p>This app helps you screen food products and restaurant menus for ingredients you have chosen to watch for. <strong>Results are informational only and are not a guarantee.</strong> Automated and AI-based analysis can make mistakes.</p>
      <p><strong>Restaurant Mode</strong> reads menu wording and estimates the ingredients a dish is <em>likely</em> to contain based on typical preparation. Menus routinely omit sub-ingredients, and preparation varies by kitchen, so these estimates can be wrong or incomplete. <strong>Always confirm with restaurant staff and read product labels</strong> before making any decision, especially where an allergy or medical condition is involved.</p>

      <h2>3. Not medical or nutritional advice</h2>
      <p>Nothing in this app is medical, dietary, or nutritional advice, and it is not a substitute for a qualified professional. You are solely responsible for your dietary decisions and for verifying ingredient information from authoritative sources.</p>

      <h2>4. Your account</h2>
      <p>You are responsible for activity under your account. Keep your sign-in secure. You may stop using the app at any time.</p>

      <h2>5. Acceptable use</h2>
      <p>Use the app only for its intended personal, non-commercial purpose. Do not misuse, disrupt, reverse-engineer, or attempt to gain unauthorized access to the service or its data.</p>

      <h2>6. Subscriptions and billing</h2>
      <p>Some features may require a paid subscription, billed through our payment processor. Prices and included features may change; changes will not apply retroactively to a period you have already paid for. You can manage or cancel your subscription through the app.</p>

      <h2>7. No warranty</h2>
      <p>The app is provided "as is" and "as available," without warranties of any kind, whether express or implied, including accuracy, fitness for a particular purpose, or uninterrupted availability.</p>

      <h2>8. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, or for any harm arising from reliance on the app's results. Your use of the app is at your own risk.</p>

      <h2>9. Changes to these terms</h2>
      <p>We may update these terms. If we make a material change, you will be asked to review and accept the updated terms before continuing to use the app.</p>

      <h2>10. Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      banner="PLACEHOLDER — replace this with the finalized Privacy Policy before launch."
    >
      <p>This is a plain-language summary standing in for the full Privacy Policy.</p>

      <h2>Information we collect</h2>
      <ul>
        <li>Your Google account identity (name, email) used to sign in.</li>
        <li>Data you create in the app — scans, profiles, watch-lists, and saved lists — stored in our database.</li>
        <li>Subscription and billing status (payment details are handled by our payment processor, not stored by us).</li>
      </ul>

      <h2>Third-party services</h2>
      <p>We rely on service providers to run the app, including Google Firebase (authentication and data storage), Google Vision (reading text from photos you scan), Anthropic (analyzing menu text), Stripe (payments), and Open Food Facts (product data). Information is shared with these providers only as needed to provide the service.</p>

      <h2>How we use your information</h2>
      <p>To provide and improve the app's features, operate your account, and process subscriptions. We do not sell your personal information.</p>

      <h2>Data retention and deletion</h2>
      <p>Your data is retained while your account is active. You can request deletion of your account and associated data by contacting us.</p>

      <h2>Contact</h2>
      <p>Privacy questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalLayout>
  );
}
```

- [ ] **Step 2: Implement `LegalPages.css`**

Create `web/src/LegalPages.css`:
```css
.legal-root {
  min-height: 100%;
  background: var(--bg, #f7f5f0);
  padding: 24px 16px;
  box-sizing: border-box;
}
.legal-content {
  max-width: 680px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid var(--border, #e2ddd3);
  border-radius: 16px;
  padding: 24px;
  line-height: 1.6;
  color: #222;
}
.legal-home { display: inline-block; margin-bottom: 12px; color: #2f6b46; text-decoration: underline; }
.legal-title { margin: 0 0 4px; font-size: 1.6rem; }
.legal-updated { margin: 0 0 16px; color: var(--muted, #666); font-size: 0.9rem; }
.legal-banner {
  background: #fff4e5;
  border: 1px solid #f0c27b;
  color: #7a4a00;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 20px;
  font-size: 0.9rem;
}
.legal-content h2 { font-size: 1.1rem; margin: 22px 0 6px; }
.legal-content a { color: #2f6b46; }
.legal-content ul { padding-left: 20px; }
```

- [ ] **Step 3: Verify it compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/LegalPages.jsx web/src/LegalPages.css
git commit -m "feat(legal): public /terms (starter) and /privacy (placeholder) pages"
```

---

## Task 5: Wire the gate into `App.jsx` + Firestore rules

Load acceptance, extend the loading gate, render `<TermsGate>` (with public legal routes still reachable) when acceptance is missing/stale, and add the public routes to the normal router. Add the `legal` Firestore rule.

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: `useLegal` from `./useLegal`; `needsTermsAcceptance`, `CURRENT_TERMS_VERSION` from `./legal`; `TermsGate` from `./TermsGate`; `TermsPage`, `PrivacyPage` from `./LegalPages`.

- [ ] **Step 1: Add imports to `App.jsx`**

In `web/src/App.jsx`, after the existing component imports (e.g. after `import SharePage from './SharePage';`), add:
```jsx
import TermsGate from './TermsGate';
import { TermsPage, PrivacyPage } from './LegalPages';
import { useLegal } from './useLegal';
import { needsTermsAcceptance, CURRENT_TERMS_VERSION } from './legal';
```

- [ ] **Step 2: Load acceptance in `AppRoutes`**

In `web/src/App.jsx`, find the hook calls at the top of `AppRoutes` (the line `const billing = useBilling(user);`) and add directly after it:
```jsx
  const legal = useLegal(user);
```

- [ ] **Step 3: Extend the loading gate to wait for acceptance**

In `web/src/App.jsx`, change the loading condition from:
```jsx
  if (!authReady) {
```
to:
```jsx
  if (!authReady || (user && legal.loading)) {
```
(Leave the spinner JSX inside that block unchanged.)

- [ ] **Step 4: Render the gate (with public legal routes) when acceptance is needed**

In `web/src/App.jsx`, immediately after the closing `}` of that loading-gate `if` block and before the main `return (` of `AppRoutes`, insert:
```jsx
  if (user && needsTermsAcceptance(legal.acceptance, CURRENT_TERMS_VERSION)) {
    return (
      <Routes>
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<TermsGate user={user} />} />
      </Routes>
    );
  }
```

- [ ] **Step 5: Add the public legal routes to the normal router**

In `web/src/App.jsx`, in the main `<Routes>` block, find the public share route:
```jsx
        <Route path="/s/:shareId" element={<SharePage />} />
```
and add directly after it:
```jsx
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
```

- [ ] **Step 6: Add the Firestore rule**

In `firestore.rules`, find the billing rule:
```
    match /users/{userId}/billing/{document} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
```
and add directly after it (still inside the same parent block):
```
    // Terms/Privacy acceptance record (versioned). Owner read/write.
    match /users/{userId}/legal/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
```

- [ ] **Step 7: Verify the build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/App.jsx firestore.rules
git commit -m "feat(legal): gate app on terms acceptance; public legal routes; firestore rule"
```

---

## Task 6: Full verification

- [ ] **Step 1: Unit test + build**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web && node --test src/legal.test.js && npx vite build
```
Expected: `legal.test.js` passes; build succeeds.

- [ ] **Step 2: Manual flow (needs a signed-in session)**

With the app running and signed in as a user who has **not** accepted:
- Gate blocks the app on entry; the checkbox toggles the "Agree & Continue" enabled state.
- Clicking "Agree & Continue" writes `users/{uid}/legal/acceptance` (`acceptedVersion: 1`) and the gate disappears without a reload.
- Reload → app loads straight to home (no gate).
- The gate's "Terms of Service" / "Privacy Policy" links open in a new tab and render the pages **without leaving the gate**.
- "Sign out" returns to the login screen.
- Load `/terms` and `/privacy` while **logged out** → both render.
- Temporarily bump `CURRENT_TERMS_VERSION` to `2` locally → a previously-accepted user sees the gate again; revert to `1` afterward.

- [ ] **Step 3: Accessibility check (manual + axe)**

- Dialog has an accessible name (`aria-labelledby` → title); focus lands in the dialog on open; Tab cycles within it.
- Checkbox is keyboard-operable and labelled; focus is visible; contrast passes AA.
- Legal pages have a correct heading outline and reflow at narrow width.

- [ ] **Step 4: Confirm the deploy prerequisite**

⚠️ Before/at deploy, the new `firestore.rules` `legal` match **must be manually published** in Firebase Console → Firestore → Rules → Publish. Without it, the acceptance write is permission-denied and the gate can never be cleared. (CI does not deploy rules.)

---

## Self-Review

**Spec coverage:**
- Version-based gate, everyone re-accepts, `CURRENT_TERMS_VERSION` + `users/{uid}/legal/acceptance {acceptedVersion, acceptedAt}` — Tasks 1, 2, 3, 5 ✓
- Loading gate waits for acceptance; render `<TermsGate>` when needed; public `/terms` `/privacy` reachable while gated (new-tab-safe) — Task 5 ✓
- Explicit checkbox → "Agree & Continue"; on-screen disclaimers (not-a-guarantee, AI-can-err, confirm-with-staff, not medical advice); "Sign out" decline — Task 3 ✓
- Public legal routes outside `RequireAuth` — Task 5 ✓
- Starter ToS (DRAFT banner, all required sections incl. Restaurant Mode caveat, billing, warranty/liability, changes, contact) + Privacy placeholder (PLACEHOLDER banner, essentials) — Task 4 ✓
- `firestore.rules` `legal` rule + manual-publish gotcha — Tasks 5, 6 ✓
- Pure `needsTermsAcceptance` unit-tested; rest manual + axe — Tasks 1, 6 ✓
- WCAG 2.1 AA (dialog role/label/focus-trap, labelled checkbox, visible focus, AA contrast, semantic headings) — Tasks 3, 4, 6 ✓

**Placeholder scan:** The `/privacy` PLACEHOLDER and ToS DRAFT banners are intentional spec content, not plan gaps. No TBD/TODO steps; every code step shows complete code.

**Type consistency:** `needsTermsAcceptance(acceptance, currentVersion)` and `CURRENT_TERMS_VERSION` (Task 1) are used with the same signature in Task 5. `useLegal(user)` returns `{ acceptance, loading }` (Task 2), consumed as `legal.loading`/`legal.acceptance` in Task 5. `TermsGate({ user })` (Task 3) is rendered as `<TermsGate user={user} />` in Task 5. `TermsPage`/`PrivacyPage` named exports (Task 4) match the imports/usage in Task 5. Storage path `users/{uid}/legal/acceptance` and field `acceptedVersion` are identical across Tasks 2, 3, 5, 6 and the rule in Task 5.
