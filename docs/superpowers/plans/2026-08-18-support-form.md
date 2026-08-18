# Support Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in-only Support form: a `/support` screen (Subject + Message) that POSTs to a `requireAuth`, rate-limited `POST /support` endpoint which writes the submission to Firestore and emails a copy to the owner via Resend — plus turning the ToS/Privacy "contact form" references into real links.

**Architecture:** New `POST /support` endpoint validates input (pure helper), writes `users/{uid}/support/{autoId}` via the Admin SDK, then sends an email through a Resend wrapper (`server/utils/mailer.js`). Identity (email/name) comes from the verified Firebase token, never the request body. The React `SupportScreen` collects Subject + Message and shows the signed-in identity read-only.

**Tech Stack:** Node/Express (Railway), `resend` SDK, Firebase Admin (Firestore), React (Vite ESM), `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-18-support-form-design.md`

## Global Constraints

- **Node 20 required** — the PATH `node` is v12. Prefix every `node`/`npm`/`npx` command with: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`. `npm install` needs `dangerouslyDisableSandbox: true`.
- **Resend SDK shape (verified):** CJS `const { Resend } = require('resend')`; `new Resend(process.env.RESEND_API_KEY)`; `await resend.emails.send({ from, to, subject, text, replyTo })` — `replyTo` is **camelCase**; the call returns `{ data, error }` (does **not** throw on API errors — check `error`).
- **Identity from the token, not the body** — `email`/`name` come from `req.email`/`req.name` (set by `requireAuth`), never from `req.body`.
- **Email-send failure is non-fatal** — if the Firestore write succeeded, return success and log the send error; only a Firestore-write failure is a 500.
- **WCAG 2.1 AA** — labelled inputs, visible focus, AA contrast on the Support screen.
- **`firestore.rules` is NOT deployed by CI** — the new `support` rule must be manually published in Firebase Console → Firestore → Rules → Publish at deploy.
- **Deploy = push to `main`** auto-deploys frontend (Firebase Hosting) and backend (Railway).
- Storage path is exactly `users/{uid}/support/{autoId}`; the endpoint is exactly `POST /support`; the default subject is exactly `Support request`.

---

## Task 1: Server dependency + env vars

**Files:**
- Modify: `server/package.json` (via npm)
- Modify: `server/.env.example`

- [ ] **Step 1: Install the Resend SDK**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && npm install resend`
Expected: `resend` appears under `dependencies` in `server/package.json`; lockfile updates.

- [ ] **Step 2: Confirm it loads on Node 20**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node -e "const { Resend } = require('resend'); console.log(typeof Resend)"`
Expected: `function`

- [ ] **Step 3: Add env vars to the example**

Edit `server/.env.example` to add three lines (keep existing lines):
```
GOOGLE_VISION_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
RESEND_API_KEY=your_resend_key_here
SUPPORT_TO=joel.rogers.design@gmail.com
SUPPORT_FROM=onboarding@resend.dev
PORT=3001
```

- [ ] **Step 4: Set the real key locally (owner)**

Add `RESEND_API_KEY=<real key>` to `server/.env` (not committed). `SUPPORT_TO`/`SUPPORT_FROM` are optional locally (defaults apply). Verify:
Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node -e "require('dotenv').config(); console.log(process.env.RESEND_API_KEY ? 'key present' : 'MISSING')"`
Expected: `key present` (if the owner has set it; otherwise this is deferred to deploy — the unit tests use a fake client and don't need it).

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add server/package.json server/package-lock.json server/.env.example
git commit -m "chore(support): add resend dep and support email env vars"
```

---

## Task 2: Pure input validation

**Files:**
- Create: `server/utils/supportValidation.js`
- Test: `server/utils/supportValidation.test.js`

**Interfaces:**
- Produces: `validateSupportInput({ subject, message }) -> { ok: true, value: { subject, message } } | { ok: false, error: string }`.

- [ ] **Step 1: Write the failing test**

Create `server/utils/supportValidation.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const { validateSupportInput } = require('./supportValidation');

test('rejects a missing or empty message', () => {
  assert.strictEqual(validateSupportInput({ message: '' }).ok, false);
  assert.strictEqual(validateSupportInput({ message: '   ' }).ok, false);
  assert.strictEqual(validateSupportInput({}).ok, false);
  assert.strictEqual(validateSupportInput({ message: 42 }).ok, false);
});

test('rejects an over-long message (>5000)', () => {
  const r = validateSupportInput({ message: 'x'.repeat(5001) });
  assert.strictEqual(r.ok, false);
});

test('accepts a valid message and trims it', () => {
  const r = validateSupportInput({ subject: 'Hi', message: '  hello  ' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.message, 'hello');
  assert.strictEqual(r.value.subject, 'Hi');
});

test('defaults a blank/missing subject to "Support request"', () => {
  assert.strictEqual(validateSupportInput({ message: 'hi' }).value.subject, 'Support request');
  assert.strictEqual(validateSupportInput({ subject: '   ', message: 'hi' }).value.subject, 'Support request');
});

test('truncates an over-long subject to 200 chars', () => {
  const r = validateSupportInput({ subject: 'S'.repeat(250), message: 'hi' });
  assert.strictEqual(r.value.subject.length, 200);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node --test utils/supportValidation.test.js`
Expected: FAIL — `Cannot find module './supportValidation'`.

- [ ] **Step 3: Implement `supportValidation.js`**

Create `server/utils/supportValidation.js`:
```js
// Pure validation/normalization for a support submission. No IO.
// Returns { ok:true, value:{ subject, message } } or { ok:false, error }.
function validateSupportInput({ subject, message } = {}) {
  if (typeof message !== 'string' || message.trim().length < 1) {
    return { ok: false, error: 'Message is required.' };
  }
  const trimmedMsg = message.trim();
  if (trimmedMsg.length > 5000) {
    return { ok: false, error: 'Message is too long (max 5000 characters).' };
  }
  let subj = typeof subject === 'string' ? subject.trim() : '';
  if (!subj) subj = 'Support request';
  if (subj.length > 200) subj = subj.slice(0, 200);
  return { ok: true, value: { subject: subj, message: trimmedMsg } };
}

module.exports = { validateSupportInput };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node --test utils/supportValidation.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add server/utils/supportValidation.js server/utils/supportValidation.test.js
git commit -m "feat(support): pure validateSupportInput helper"
```

---

## Task 3: Resend mailer wrapper

**Files:**
- Create: `server/utils/mailer.js`
- Test: `server/utils/mailer.test.js`

**Interfaces:**
- Consumes: `resend` SDK; env `RESEND_API_KEY`, `SUPPORT_TO`, `SUPPORT_FROM`.
- Produces: `sendSupportEmail({ subject, message, email, name }, { client } = {}) -> Promise<data>`. Throws if the Resend call returns an `error`. `client` is injectable for tests (defaults to a lazily-constructed `Resend`).

- [ ] **Step 1: Write the failing test**

Create `server/utils/mailer.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const { sendSupportEmail } = require('./mailer');

function fakeResend(capture, result = { data: { id: 'abc' }, error: null }) {
  return { emails: { send: async (payload) => { capture.payload = payload; return result; } } };
}

test('sends with owner default To, submitter Reply-To, and prefixed subject', async () => {
  delete process.env.SUPPORT_TO;
  delete process.env.SUPPORT_FROM;
  const cap = {};
  await sendSupportEmail(
    { subject: 'Need help', message: 'It broke', email: 'user@example.com', name: 'Jane' },
    { client: fakeResend(cap) }
  );
  assert.strictEqual(cap.payload.to, 'joel.rogers.design@gmail.com');
  assert.strictEqual(cap.payload.from, 'onboarding@resend.dev');
  assert.strictEqual(cap.payload.replyTo, 'user@example.com');
  assert.strictEqual(cap.payload.subject, '[IngredientScan Support] Need help');
  assert.match(cap.payload.text, /It broke/);
  assert.match(cap.payload.text, /Jane/);
});

test('respects SUPPORT_TO / SUPPORT_FROM overrides', async () => {
  process.env.SUPPORT_TO = 'ops@ingredientscan.app';
  process.env.SUPPORT_FROM = 'Support <help@ingredientscan.app>';
  const cap = {};
  await sendSupportEmail({ subject: 'x', message: 'y', email: 'a@b.com', name: 'A' }, { client: fakeResend(cap) });
  assert.strictEqual(cap.payload.to, 'ops@ingredientscan.app');
  assert.strictEqual(cap.payload.from, 'Support <help@ingredientscan.app>');
  delete process.env.SUPPORT_TO;
  delete process.env.SUPPORT_FROM;
});

test('throws when Resend returns an error', async () => {
  const client = { emails: { send: async () => ({ data: null, error: { message: 'bad key' } }) } };
  await assert.rejects(
    () => sendSupportEmail({ subject: 's', message: 'm', email: 'a@b.com', name: 'A' }, { client }),
    /bad key/
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node --test utils/mailer.test.js`
Expected: FAIL — `Cannot find module './mailer'`.

- [ ] **Step 3: Implement `mailer.js`**

Create `server/utils/mailer.js`:
```js
const { Resend } = require('resend');

let defaultClient = null;
function getClient() {
  if (!defaultClient) defaultClient = new Resend(process.env.RESEND_API_KEY);
  return defaultClient;
}

// Emails the owner a copy of a support submission via Resend.
// Reply-To is the submitter so the owner can just hit reply.
// Returns the Resend `data`; throws if Resend returns an `error`.
async function sendSupportEmail({ subject, message, email, name }, { client } = {}) {
  const resend = client || getClient();
  const to = process.env.SUPPORT_TO || 'joel.rogers.design@gmail.com';
  const from = process.env.SUPPORT_FROM || 'onboarding@resend.dev';
  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo: email || undefined,
    subject: `[IngredientScan Support] ${subject}`,
    text: `From: ${name || 'Unknown'} <${email || 'no email'}>\n\n${message}`,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return data;
}

module.exports = { sendSupportEmail };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd server && node --test utils/mailer.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add server/utils/mailer.js server/utils/mailer.test.js
git commit -m "feat(support): Resend mailer wrapper with injectable client"
```

---

## Task 4: `POST /support` route + auth identity + mount + rule

**Files:**
- Modify: `server/middleware/requireAuth.js`
- Create: `server/routes/support.js`
- Modify: `server/index.js`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: `validateSupportInput` (Task 2), `sendSupportEmail` (Task 3), `requireAuth`, `firebaseAdmin`, `createRateLimiter`.
- Produces: `POST /support` returning `{ ok: true }` on success, `{ error }` with 400 (validation) / 500 (write failure) / 429 (rate limit).

- [ ] **Step 1: Add email/name to `requireAuth`**

In `server/middleware/requireAuth.js`, change:
```js
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
```
to:
```js
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.email = decoded.email || null;
    req.name = decoded.name || null;
    next();
```

- [ ] **Step 2: Create the route**

Create `server/routes/support.js`:
```js
const express = require('express');
const admin = require('../utils/firebaseAdmin');
const requireAuth = require('../middleware/requireAuth');
const { validateSupportInput } = require('../utils/supportValidation');
const { sendSupportEmail } = require('../utils/mailer');

const router = express.Router();

// Logged-in contact form. Writes the submission to Firestore, then emails the
// owner a copy. Identity comes from the verified token, never the body.
router.post('/', requireAuth, async (req, res) => {
  const result = validateSupportInput(req.body || {});
  if (!result.ok) return res.status(400).json({ error: result.error });
  const { subject, message } = result.value;
  const email = req.email || null;
  const name = req.name || null;

  // 1. Durable record first (Admin SDK bypasses client rules).
  try {
    await admin.firestore()
      .collection('users').doc(req.uid).collection('support').doc()
      .set({ subject, message, email, name, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error('Support write failed:', err.message);
    return res.status(500).json({ error: 'Could not submit. Please try again.' });
  }

  // 2. Email copy — non-fatal: a send failure does not lose the submission.
  try {
    await sendSupportEmail({ subject, message, email, name });
  } catch (err) {
    console.error('Support email send failed (submission saved):', err.message);
  }

  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 3: Mount it in `index.js`**

In `server/index.js`, after `const shareRoutes = require('./routes/share');` add:
```js
const supportRoutes = require('./routes/support');
```
After `const stripeLimiter = createRateLimiter({ max: 20, windowMs: 60000 });` add:
```js
const supportLimiter = createRateLimiter({ max: 5, windowMs: 60000 });
```
After `app.use('/share', shareRoutes);` add:
```js
app.use('/support', supportLimiter, supportRoutes);
```

- [ ] **Step 4: Add the Firestore rule**

In `firestore.rules`, after the `billing` match block, add:
```
    // Support submissions are server-written (Admin SDK). Client read-only.
    match /users/{userId}/support/{document} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
```

- [ ] **Step 5: Verify the server loads and the full suite passes**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/server
node -e "require('./routes/support'); require('./index.js') " 2>&1 | head -1 || true
node --test 2>&1 | grep -E "# tests|# pass|# fail"
```
Note: `require('./index.js')` starts the server listening; if it hangs, just run the module-load check `node -e "require('./routes/support'); console.log('route loads')"` instead. Expected: route loads; full suite passes (existing + supportValidation + mailer).

- [ ] **Step 6: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add server/middleware/requireAuth.js server/routes/support.js server/index.js firestore.rules
git commit -m "feat(support): POST /support endpoint, auth identity, mount, firestore rule"
```

---

## Task 5: Client — API + Support screen + route + footer link

**Files:**
- Modify: `web/src/api.js`
- Create: `web/src/SupportScreen.jsx`
- Create: `web/src/SupportScreen.css`
- Modify: `web/src/App.jsx`
- Modify: `web/src/HomeScreen.jsx`
- Modify: `web/src/HomeScreen.css`

**Interfaces:**
- Consumes: `submitSupport` from `./api`; `auth` from `./firebase`.
- Produces: `default export SupportScreen({ onBack })`; `submitSupport({ subject, message })`.

- [ ] **Step 1: Add the API helper**

Append to `web/src/api.js`:
```js
export async function submitSupport({ subject, message }) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ subject, message }),
  }));
}
```

- [ ] **Step 2: Create `SupportScreen.jsx`**

Create `web/src/SupportScreen.jsx`:
```jsx
import { useState } from 'react';
import { auth } from './firebase';
import { submitSupport } from './api';
import './SupportScreen.css';

export default function SupportScreen({ onBack }) {
  const user = auth.currentUser;
  const [subject, setSubject] = useState('Support request');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending' || !message.trim()) return;
    setStatus('sending');
    setError(null);
    try {
      await submitSupport({ subject, message });
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  return (
    <div className="support-root">
      <div className="support-scroll">
        {onBack && (
          <button className="support-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
        )}
        <h1 className="support-title">Support</h1>

        {status === 'sent' ? (
          <div className="support-sent" role="status">
            <p className="support-sent-title">Thanks — we got your message.</p>
            <p className="support-sent-sub">We’ll get back to you{user?.email ? ` at ${user.email}` : ''}.</p>
            <button className="support-primary" onClick={onBack}>Back to app</button>
          </div>
        ) : (
          <form className="support-form" onSubmit={handleSubmit}>
            <p className="support-sending-as">
              Sending as {user?.displayName || 'you'}{user?.email ? ` · ${user.email}` : ''}
            </p>

            <label className="support-label" htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              className="support-input"
              type="text"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />

            <label className="support-label" htmlFor="support-message">How can we help?</label>
            <textarea
              id="support-message"
              className="support-textarea"
              value={message}
              maxLength={5000}
              rows={8}
              placeholder="Describe your question or issue…"
              onChange={(e) => setMessage(e.target.value)}
            />

            {error && <p className="support-error" role="alert">{error}</p>}

            <button className="support-primary" type="submit" disabled={status === 'sending' || !message.trim()}>
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `SupportScreen.css`**

Create `web/src/SupportScreen.css`:
```css
.support-root { display: flex; flex-direction: column; height: 100%; background: var(--bg, #f7f5f0); }
.support-scroll { flex: 1; overflow-y: auto; padding: 16px; max-width: 560px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.support-back { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted, #555); font: inherit; cursor: pointer; padding: 4px 0; margin-bottom: 8px; }
.support-title { margin: 0 0 16px; font-size: 1.5rem; }
.support-sending-as { margin: 0 0 16px; color: var(--muted, #666); font-size: 0.9rem; }
.support-form { display: flex; flex-direction: column; }
.support-label { font-weight: 600; margin: 12px 0 6px; }
.support-input, .support-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border, #d9d3c7);
  border-radius: 10px;
  padding: 12px;
  font: inherit;
  background: #fff;
}
.support-textarea { resize: vertical; }
.support-input:focus-visible, .support-textarea:focus-visible {
  outline: 2px solid #2f6b46;
  outline-offset: 1px;
}
.support-error { color: #b23b3b; margin: 12px 0 0; }
.support-primary {
  margin-top: 18px;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--sage, #4a7c59);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.support-primary:disabled { opacity: 0.5; cursor: default; }
.support-sent { text-align: center; padding-top: 24px; }
.support-sent-title { font-size: 1.15rem; font-weight: 600; margin: 0 0 6px; }
.support-sent-sub { color: var(--muted, #666); margin: 0 0 20px; }
```

- [ ] **Step 4: Add the route + Home wiring in `App.jsx`**

In `web/src/App.jsx`:

(a) After `import HistoryScreen from './HistoryScreen';` (or near the other screen imports) add:
```jsx
import SupportScreen from './SupportScreen';
```

(b) Change the `HomeRoute` component signature and body to thread an `onSupport` prop. Replace:
```jsx
function HomeRoute({ user, onScan, onHistory, onProfiles, onLists, onUpgrade }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onProfiles={onProfiles} onLists={onLists} onUpgrade={onUpgrade} />;
}
```
with:
```jsx
function HomeRoute({ user, onScan, onHistory, onProfiles, onLists, onUpgrade, onSupport }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onProfiles={onProfiles} onLists={onLists} onUpgrade={onUpgrade} onSupport={onSupport} />;
}
```

(c) In the `<HomeRoute ... />` usage (inside the `/home` route), add the `onSupport` prop next to `onUpgrade`:
```jsx
                onUpgrade={() => navigate('/upgrade')}
                onSupport={() => navigate('/support')}
```

(d) Add the `/support` route inside the authenticated `<Routes>` (e.g. right after the `/lists/:listId` route), matching the existing `RequireAuth` wrapper style:
```jsx
        <Route
          path="/support"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <SupportScreen onBack={() => navigate('/home')} />
            </RequireAuth>
          }
        />
```

- [ ] **Step 5: Add the "Support" link to the Home footer**

In `web/src/HomeScreen.jsx`, change the component signature:
```jsx
export default function HomeScreen({ user, onScan, onHistory, onProfiles, onLists, onUpgrade }) {
```
to:
```jsx
export default function HomeScreen({ user, onScan, onHistory, onProfiles, onLists, onUpgrade, onSupport }) {
```
Then in the footer, add a Support button before the legal links. Replace:
```jsx
        <button className="home-footer-btn" onClick={() => setShowAbout(true)}>
          How are ingredients flagged?
        </button>
        <p className="home-footer-legal">
```
with:
```jsx
        <button className="home-footer-btn" onClick={() => setShowAbout(true)}>
          How are ingredients flagged?
        </button>
        <button className="home-footer-btn" onClick={onSupport}>
          Support
        </button>
        <p className="home-footer-legal">
```

- [ ] **Step 6: (No new CSS needed — `home-footer-btn` already styled.)** Verify the build compiles

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/api.js web/src/SupportScreen.jsx web/src/SupportScreen.css web/src/App.jsx web/src/HomeScreen.jsx
git commit -m "feat(support): SupportScreen, /support route, submitSupport API, Home footer link"
```

---

## Task 6: Wire the ToS/Privacy "contact form" references to `/support`

**Files:**
- Modify: `web/src/LegalPages.jsx`
- Modify: `legal-docs/terms-of-service.md`
- Modify: `legal-docs/privacy-policy.md`

- [ ] **Step 1: Link the Terms §17 reference**

In `web/src/LegalPages.jsx`, in `TermsPage`, replace:
```jsx
      <h2>17. Contact Us</h2>
      <p>Questions about these Terms can be submitted through the contact form available in the App.</p>
```
with:
```jsx
      <h2>17. Contact Us</h2>
      <p>Questions about these Terms can be submitted through the <a href="/support">contact form</a> available in the App.</p>
```

- [ ] **Step 2: Link the Privacy §9 reference**

In `web/src/LegalPages.jsx`, in `PrivacyPage`, replace:
```jsx
      <h2>9. Contact Us</h2>
      <p>Questions about this Privacy Policy, or requests to exercise your privacy rights, can be submitted through the contact form available in the App.</p>
```
with:
```jsx
      <h2>9. Contact Us</h2>
      <p>Questions about this Privacy Policy, or requests to exercise your privacy rights, can be submitted through the <a href="/support">contact form</a> available in the App.</p>
```

- [ ] **Step 3: Sync the markdown sources**

In `legal-docs/terms-of-service.md`, replace the §17 line:
```
Questions about these Terms can be submitted through the contact form available in the App.
```
with:
```
Questions about these Terms can be submitted through the [contact form](/support) available in the App.
```
In `legal-docs/privacy-policy.md`, replace the §9 line:
```
Questions about this Privacy Policy, or requests to exercise your privacy rights, can be submitted through the contact form available in the App.
```
with:
```
Questions about this Privacy Policy, or requests to exercise your privacy rights, can be submitted through the [contact form](/support) available in the App.
```

- [ ] **Step 4: Verify the build compiles**

Run: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"; cd web && npx vite build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app
git add web/src/LegalPages.jsx legal-docs/terms-of-service.md legal-docs/privacy-policy.md
git commit -m "feat(support): link ToS/Privacy contact-form references to /support"
```

---

## Task 7: Full verification

- [ ] **Step 1: Server suite + web build**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/joelrogers/Sandbox/barcode-scan-app/server && node --test 2>&1 | grep -E "# tests|# pass|# fail"
cd /Users/joelrogers/Sandbox/barcode-scan-app/web && npx vite build 2>&1 | grep -E "built in|error" | head
```
Expected: server suite passes (existing + supportValidation + mailer); web build succeeds.

- [ ] **Step 2: Manual flow (needs signed-in session + RESEND_API_KEY)**

- Home footer "Support" → `/support`; the "Sending as {name} · {email}" line shows the signed-in identity.
- Subject pre-filled "Support request" (editable); empty message keeps Send disabled.
- Submit → success state; a record appears at `users/{uid}/support/{id}` in Firestore; an email arrives in the owner inbox with subject `[IngredientScan Support] …` and reply-to = the user's email.
- Rapid submits (>5/min) → 429 surfaced as an error.
- ToS §17 / Privacy §9 "contact form" links go to `/support` (logged-in) or route through login (logged-out).

- [ ] **Step 3: Accessibility check**

- Subject and message inputs are labelled (`<label htmlFor>`); focus is visible; contrast passes AA; the success state uses `role="status"` and errors use `role="alert"`.

- [ ] **Step 4: Deploy prerequisites (owner)**

⚠️ Before/at deploy: (a) set `RESEND_API_KEY` (and optionally `SUPPORT_FROM` to a verified `ingredientscan.app` sender once DNS is verified in Resend) in the **Railway** backend env; (b) manually publish the new `firestore.rules` `support` match in Firebase Console → Firestore → Rules → Publish (CI doesn't deploy rules). Without `RESEND_API_KEY`, the submission still saves to Firestore but the email send logs an error and is skipped.

---

## Self-Review

**Spec coverage:**
- `POST /support` behind `requireAuth` + rate limiter; Firestore write + Resend email; identity from token — Tasks 3, 4 ✓
- Fields: Subject (default "Support request", editable) + Message; name/email auto-captured/shown — Tasks 2, 5 ✓
- Placement: `/support` screen + Home footer "Support" link (logged-in surface) — Task 5 ✓
- Email-send failure non-fatal; Firestore-write failure → 500 — Task 4 ✓
- Storage `users/{uid}/support/{autoId}`, client read-only rule — Task 4 ✓
- Resend transport, `RESEND_API_KEY`/`SUPPORT_TO`/`SUPPORT_FROM`, env-swappable sender — Tasks 1, 3 ✓
- ToS §17 / Privacy §9 "contact form" → `/support` links, both rendered + markdown sources — Task 6 ✓
- Unit tests: `validateSupportInput` + `sendSupportEmail` (fake client, no live API) — Tasks 2, 3 ✓
- WCAG 2.1 AA (labelled inputs, focus, contrast, status/alert roles) — Tasks 5, 7 ✓
- Manual-publish rules gotcha + Railway env — Tasks 4, 7 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Owner-operational items (real `RESEND_API_KEY`, Resend DNS verification) are explicitly deploy/setup steps, not plan gaps.

**Type consistency:** `validateSupportInput({subject,message}) -> {ok,value:{subject,message}}|{ok,error}` (Task 2) consumed identically in Task 4. `sendSupportEmail({subject,message,email,name},{client})` (Task 3) called with those exact keys in Task 4. `submitSupport({subject,message})` (Task 5) matches the route body contract (Task 4). `onSupport` prop is defined on `HomeScreen`/`HomeRoute` and wired to `navigate('/support')` (Task 5). Firestore path `users/{uid}/support/{autoId}` and field set `{subject,message,email,name,createdAt}` identical across Task 4 and the rule.
