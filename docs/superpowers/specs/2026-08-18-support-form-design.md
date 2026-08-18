# Support Form — Design Spec

**Date:** 2026-08-18
**Status:** Approved
**Builds on:** Existing Express/Railway backend (`requireAuth`, `createRateLimiter`, Admin-SDK Firestore writes), the `users/{uid}` Firestore doc pattern, the client `api.js` fetch helpers, and the Home/Login footers + `/terms` `/privacy` pages added in the Terms Gate work.

## Overview

A **logged-in-only contact/support form**. A new `SupportScreen` at `/support` (reached from the Home footer) lets a signed-in user send a **Subject** (pre-filled "Support request", editable) and a **Message**. A new `POST /support` endpoint (behind `requireAuth` + a rate limiter) **writes the submission to Firestore** and **emails a copy to the owner via Resend**, with the user's email as reply-to. The owner's address is never exposed to the client. This also fulfills the "contact form available in the App" references already live in the Terms of Service (§17) and Privacy Policy (§9), which this work turns into real links to `/support`.

## Program Context

Backlog item "Feedback form in footer" (owner request: name + email + comments, stored in Firestore + a copy emailed to the owner, linked from the footer without exposing the address). Identity (name/email) is auto-captured from the signed-in account, so the form itself only collects Subject + Message. Pulled up now because it's referenced by the shipped legal pages.

## Design Decisions

| Question | Decision |
|----------|----------|
| Email transport | **Resend** (`resend` SDK, `RESEND_API_KEY`). Chosen over Gmail/Nodemailer SMTP (fragile, spam-prone) and Firestore-only (drops the emailed copy). |
| Auth | **Logged-in only.** `POST /support` behind `requireAuth`; `SupportScreen` behind `RequireAuth`. Identity comes from the verified token, never the request body. |
| Fields | **Subject** (editable, server-defaults to "Support request" if blank) + **Message** (required). Name + email auto-captured from the signed-in account and shown read-only ("Sending as {name} · {email}"). |
| Placement | Dedicated **`/support` screen**, linked "Support" in the **Home footer** beside Terms/Privacy (logged-in surface; not the logged-out Login footer). |
| Abuse guard | Dedicated `createRateLimiter({ max: 5, windowMs: 60000 })` on the route, even though auth-gated. |
| Email-send failure | If the Firestore write succeeds but the Resend send throws, **still return success** (submission preserved), log the send error server-side. Firestore-write failure → 500. |
| Storage & rules | Server writes `users/{uid}/support/{autoId}` via Admin SDK (bypasses rules). Client is **read-only, write-denied** on this collection (like billing). |
| Legal-doc links | Turn the ToS §17 / Privacy §9 "contact form available in the App" prose into real links to `/support`, in both `LegalPages.jsx` (rendered) and `legal-docs/*.md` (source copies). |

## Architecture & Data Flow

```
Home footer "Support" → /support (SupportScreen, RequireAuth)
  form fields: subject (pre-filled "Support request", editable) + message (textarea)
  read-only line: "Sending as {name} · {email}" (from auth.currentUser)
   → api.submitSupport({ subject, message })  [Authorization: Bearer <idToken>]

POST /support  (app.use('/support', supportLimiter, supportRoutes))
   requireAuth → req.uid; email/name decoded from the verified token
   supportLimiter → per-IP 5/min
   1. validateSupportInput({ subject, message })  (pure)
   2. Admin SDK write: users/{uid}/support/{autoId}
        { subject, message, email, name, createdAt: serverTimestamp() }
   3. mailer.sendSupportEmail({ subject, message, email, name })  (Resend)
        — on throw: log, do NOT fail the request
   4. 200 { ok: true }
```

### New: `server/utils/supportValidation.js` (pure, unit-tested)
- `validateSupportInput({ subject, message }) -> { ok: true, value: { subject, message } } | { ok: false, error: string }`.
- Rules: `message` must be a string, trimmed length ≥ 1 and ≤ 5000 (else error). `subject` optional string; trimmed; if empty → `"Support request"`; capped at 200 chars (truncate, not error). Returns the normalized `{ subject, message }`. No IO.

### New: `server/utils/mailer.js` (Resend wrapper)
- `sendSupportEmail({ subject, message, email, name })` — constructs and sends via the `resend` SDK using `process.env.RESEND_API_KEY`.
  - **to:** `process.env.SUPPORT_TO || 'joel.rogers.design@gmail.com'`
  - **from:** `process.env.SUPPORT_FROM || 'onboarding@resend.dev'` (env-swappable so the owner flips to a verified `ingredientscan.app` sender without a code change)
  - **replyTo:** the submitter's `email`
  - **subject:** `` `[IngredientScan Support] ${subject}` ``
  - **body:** plain text including name, email, and the message.
- Injectable client for tests: `sendSupportEmail(payload, { client })` — defaults to a lazily-constructed `new Resend(process.env.RESEND_API_KEY)`. Mirrors `menuAnalyzer`'s injectable-client testing pattern.

### New: `server/routes/support.js`
- `POST /` (`requireAuth`): reads `{ subject, message }` from the body; pulls `email`/`name` from the decoded token (see requireAuth note below); validates; writes Firestore; calls the mailer (guarded); returns `{ ok: true }`. On validation failure → 400 with the error; on Firestore-write failure → 500.

### Modified: `server/middleware/requireAuth.js`
- Currently sets only `req.uid = decoded.uid`. Add `req.email = decoded.email || null` and `req.name = decoded.name || null` so the support route can capture identity from the verified token (not the body). Low-risk, additive; other routes ignore the new fields.

### Modified: `server/index.js`
- `const supportRoutes = require('./routes/support');`
- `const supportLimiter = createRateLimiter({ max: 5, windowMs: 60000 });`
- `app.use('/support', supportLimiter, supportRoutes);` (alongside the other `app.use` mounts).

### Modified: `server/package.json` + env
- Add `resend` dependency.
- New env vars (local `.env` + Railway): `RESEND_API_KEY` (required for send), `SUPPORT_TO` (optional, defaults to the owner address), `SUPPORT_FROM` (optional, defaults to `onboarding@resend.dev`). Add all three to `.env.example`.

### Modified: `firestore.rules`
- Add, after the billing rule:
  ```
  // Support submissions are server-written (Admin SDK). Client read-only.
  match /users/{userId}/support/{document} {
    allow read: if request.auth != null && request.auth.uid == userId;
  }
  ```
- ⚠️ **Deploy gotcha (project-wide):** CI does not deploy `firestore.rules`. Must be manually published in Firebase Console → Firestore → Rules → Publish at deploy. (Here the risk is low — denying client writes is the default anyway — but publish for consistency and to allow the owner-read.)

## Client

### New: `web/src/SupportScreen.jsx` + `web/src/SupportScreen.css`
- Subject input (default value "Support request"), message `<textarea>`, a read-only "Sending as {name} · {email}" line (from `auth.currentUser.displayName` / `.email`), a Submit button (disabled while sending or message empty), inline error, and a success state ("Thanks — we'll get back to you at {email}."). Back link to Home. WCAG 2.1 AA: labelled inputs, visible focus, AA contrast.

### Modified: `web/src/api.js`
- `submitSupport({ subject, message })` → `POST /support` with the bearer token (same shape as `scanMenu`).

### Modified: `web/src/App.jsx`
- Import `SupportScreen`; add `<Route path="/support" ... />` inside `RequireAuth`.

### Modified: `web/src/HomeScreen.jsx` + `web/src/HomeScreen.css`
- Add a "Support" link to the `home-footer-legal` row (or adjacent), navigating to `/support`. Passed via the existing `onSupport`/navigate pattern used for other Home actions.

### Modified: legal content — turn prose into links
- `web/src/LegalPages.jsx`: in `TermsPage` §17 and `PrivacyPage` §9, render "contact form available in the App" with the phrase "contact form" as an `<a href="/support">`. (Logged-out readers clicking it are routed through login by `RequireAuth` — acceptable, since submitting requires an account.)
- `legal-docs/terms-of-service.md` and `legal-docs/privacy-policy.md`: update the same sentences to reference `/support` so the source copies stay in sync with the rendered pages.

## Testing

- **Server unit (`node --test`):**
  - `validateSupportInput` — empty/whitespace message → `{ ok:false }`; > 5000 chars → `{ ok:false }`; valid message → `{ ok:true }` trimmed; blank subject → defaults to "Support request"; > 200-char subject → truncated; subject trimmed.
  - `sendSupportEmail` with an **injected fake Resend client** — asserts it calls `client.emails.send` with `to` = `SUPPORT_TO` default, `replyTo` = submitter email, and the `[IngredientScan Support]` subject prefix. **Never** hits the live Resend API in tests.
- **Client (manual):** submit from `/support` → success state; a record appears at `users/{uid}/support/{id}` in Firestore; an email arrives in the owner inbox with correct reply-to and subject; validation error shows for an empty message; the rate limiter returns 429 after 5 rapid submits; the ToS/Privacy "contact form" links reach `/support` (logged-in) / route through login (logged-out).
- **Accessibility (manual):** inputs labelled, focus visible, contrast AA.

## What Does Not Change

- Auth mechanism, scanning, profiles, lists, sharing, billing/Stripe — untouched. The support route only adds an endpoint.
- The Terms Gate and legal pages structure — only the two "contact form" sentences become links.

## Out of Scope (later / YAGNI)

- An in-app admin view of submissions (owner reads them via inbox / Firebase console).
- File attachments; auto-reply to the submitter; ticket threading.
- A logged-out/public contact path (form is logged-in only).
- Domain verification for Resend is an **operational setup step**, not code: the owner verifies `ingredientscan.app` DNS in Resend and sets `SUPPORT_FROM` to a verified sender; until then the default sandbox sender works for testing.
