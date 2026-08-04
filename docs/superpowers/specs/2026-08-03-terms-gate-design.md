# Terms Gate — Design Spec

**Date:** 2026-08-03
**Status:** Approved
**Builds on:** Existing Firebase auth (`signInWithPopup` → `onSignedIn`), the `useBilling`/`users/{uid}/billing/info` Firestore user-doc pattern, and the app's WCAG 2.1 AA requirement.

## Overview

A **version-based Terms acceptance gate** shown between sign-in and the app. Its purpose is a liability disclaimer: scan results — **especially Restaurant Mode menu scans**, now live in production, which infer *likely* ingredients from prose — are informational only, **not a guarantee**, and AI/automated analysis can make mistakes. Users must explicitly accept before entering the app. Acceptance is stored in Firestore and versioned, so **all users (new and existing)** see the gate once on first release, and everyone re-accepts if the terms materially change later.

This spec also adds two public in-app legal pages: `/terms` (a **plain-language starter Terms of Service** drafted here — explicitly a non-lawyer starter the owner must review/replace) and `/privacy` (a **container with a clearly-marked placeholder** for the Privacy Policy the owner will generate).

## Program Context

Backlog item "Legal / Terms acceptance," pulled forward because Restaurant Mode shipped to production 2026-07-24 and the Restaurant Mode spec explicitly deferred this gate as its prerequisite (results not a guarantee / AI can err). See `docs/superpowers/specs/2026-07-21-restaurant-mode-design.md`.

## Design Decisions

| Question | Decision |
|----------|----------|
| Scope of legal copy | I draft a **plain-language starter ToS** (clearly marked non-legal-advice, owner reviews/replaces). Owner generates the **Privacy Policy**; `/privacy` is a placeholder container. Both pages display whatever content is placed in them. |
| Who must accept | **Everyone.** Version-based gating: anyone whose stored `acceptedVersion` is missing or `< CURRENT_TERMS_VERSION` sees the gate — new sign-ups and existing users alike, with zero migration. |
| Acceptance action | **Explicit checkbox** ("I have read and agree to the Terms of Service and Privacy Policy") that enables an **"Agree & Continue"** button. Disclaimers shown on-screen; checkbox references the linked full docs. |
| Decline path | No app without accepting. A **"Sign out"** link so users are never trapped on the gate. |
| Storage | `users/{uid}/legal/acceptance` doc (mirrors `billing/info`): `{ acceptedVersion: <int>, acceptedAt: serverTimestamp() }`. |
| Version source of truth | A single code constant `CURRENT_TERMS_VERSION` (integer, starts at `1`). Bump manually on material change → everyone re-accepts once. |
| Legal pages visibility | `/terms` and `/privacy` are **public** routes (viewable logged-out), so they're linkable and reusable by a future landing page, and readable from the gate. |
| Reading full docs from the gate | Links open with `target="_blank" rel="noopener noreferrer"` so reading never navigates off the gate. |
| Accessibility | WCAG 2.1 AA — gate is a proper focus-trapped `role="dialog"`; native labelled checkbox; visible focus; AA contrast; semantic headings on content pages. |

## Architecture & Data Flow

```
sign-in (existing) ──▶ App.jsx gate:
   authReady? ──no──▶ existing spinner
   legal loading? ──yes──▶ existing spinner
   accepted current version? ──yes──▶ normal routes (/home, ...)
                              ──no───▶ <TermsGate>  (blocks the routed app)

<TermsGate> ─ checkbox + "Agree & Continue" ─▶ write users/{uid}/legal/acceptance
                                                { acceptedVersion: CURRENT_TERMS_VERSION,
                                                  acceptedAt: serverTimestamp() }
             ─ "Terms of Service" / "Privacy Policy" links ─▶ /terms, /privacy (new tab)
             ─ "Sign out" ─▶ signOut(auth)

/terms, /privacy ─ public routes, render long-form content components
```

### New: `web/src/legal.js` (constant + pure predicate)
- `export const CURRENT_TERMS_VERSION = 1;`
- `export function needsTermsAcceptance(acceptance, currentVersion)` — returns `true` when `acceptance` is null/undefined, has no numeric `acceptedVersion`, or `acceptedVersion < currentVersion`; else `false`. Pure, no imports — unit-testable.

### New: `web/src/useLegal.js` (hook, mirrors the `useBilling` pattern)
- `useLegal(user)` subscribes to `doc(db, 'users', user.uid, 'legal', 'acceptance')` via `onSnapshot`; returns `{ acceptance, loading }`. No user → `{ acceptance: null, loading: false }`. On snapshot error, logs and resolves to `{ acceptance: null, loading: false }` (fails toward showing the gate, never toward silently skipping it).
- Also exports `LegalContext` + `useLegalContext` consistent with `BillingContext`, if convenient — otherwise the value is passed through `AppRoutes` like `billing`.

### New: `web/src/TermsGate.jsx` + `web/src/TermsGate.css`
- Full-screen accessible dialog. Props: `{ onAccept }` (writes the doc) — or writes internally using `user`. Renders heading, the on-screen disclaimer list, the two external links, the checkbox, the "Agree & Continue" button (disabled until checkbox ticked), and the "Sign out" link.
- On accept: `setDoc(doc(db, 'users', user.uid, 'legal', 'acceptance'), { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: serverTimestamp() }, { merge: true })`. The live `onSnapshot` in `useLegal` then flips the gate off — no manual navigation needed.

### New: `web/src/LegalPages.jsx` (+ CSS) — `TermsPage` and `PrivacyPage`
- Two exported components rendering static long-form content with a "Last updated" date and semantic heading hierarchy. Routed at `/terms` and `/privacy`, **outside** `RequireAuth` (public).

### Modified: `web/src/App.jsx`
- Import `useLegal`, `TermsGate`, `needsTermsAcceptance`, `CURRENT_TERMS_VERSION`, `TermsPage`, `PrivacyPage`.
- In `AppRoutes`, call `const legal = useLegal(user);`.
- Extend the loading gate: keep showing the spinner while `authReady` is false **or** (`user` exists and `legal.loading`).
- After auth is ready and legal is loaded, when `user` exists and `needsTermsAcceptance(legal.acceptance, CURRENT_TERMS_VERSION)` is true, render a **gated `<Routes>`** *instead of* the normal one — but keep the two public legal routes matchable so the gate's links (and new-tab reloads) still resolve to the pages rather than bouncing back to the gate:
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
  This block sits after the loading gate and before the normal `<Routes>`. It resolves the otherwise-broken case where a gated user opening `/terms` in a new tab would re-mount the app, re-gate, and never see the page.
- In the **normal** `<Routes>` (rendered when not gated / logged out), also add `<Route path="/terms" element={<TermsPage />} />` and `<Route path="/privacy" element={<PrivacyPage />} />` at the public level (alongside `/s/:shareId`), not inside `RequireAuth`, so accepted and logged-out users can reach them too.

### Modified: `firestore.rules`
- Add owner-only access for the legal subtree:
  ```
  match /users/{uid}/legal/{docId} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```
- ⚠️ **Deploy gotcha (project-wide):** CI does **not** deploy `firestore.rules`. This rule **must be manually published** in Firebase Console → Firestore → Rules → Publish at deploy, or the acceptance write fails with permission-denied and the gate can never be satisfied.

## Content

### `/terms` — starter Terms of Service (drafted here)
Top banner: *"DRAFT — plain-language starter, not legal advice. Review with a professional before relying on it."* Sections (plain language): acceptance of terms; **the service is informational only — results are not a guarantee and automated/AI analysis (especially Restaurant Mode menu scans, which infer likely ingredients from prose and can miss omitted sub-ingredients) can be wrong — always confirm with restaurant staff and product labels**; not medical or nutritional advice; **you assume responsibility for dietary decisions**; acceptable use; accounts; subscription & billing (references the existing Stripe subscription); disclaimer of warranties; limitation of liability; changes to the terms (with a note that material changes re-prompt acceptance); contact (`joel.rogers.design@gmail.com`); "Last updated" date.

### `/privacy` — placeholder container
Top banner: *"PLACEHOLDER — replace with the generated Privacy Policy before launch."* Includes the plain-language essentials as a stand-in (what's collected: Google account identity, scans/profiles/lists stored in Firestore, Stripe billing; third parties: Firebase, Google Vision, Anthropic, Stripe, Open Food Facts; data retention & deletion; contact) so the page is coherent while the owner swaps in the real policy. "Last updated" date.

## Testing

- **Unit (pure predicate):** `needsTermsAcceptance` — null/undefined acceptance → true; `{}` (no version) → true; `{ acceptedVersion: 0 }` with current `1` → true; `{ acceptedVersion: 1 }` with current `1` → false; `{ acceptedVersion: 2 }` with current `1` → false. If a client test runner is not present, this predicate is plain framework-agnostic JS and can be exercised with a `node --test` file that requires it directly; otherwise verify by the manual cases below.
- **Client (manual):** gate blocks the app for a signed-in, not-yet-accepted user; checkbox toggles the "Agree & Continue" enabled state; accepting writes `users/{uid}/legal/acceptance` and the gate does not reappear on reload; an existing (pre-feature) user sees the gate exactly once; "Sign out" returns to login; `/terms` and `/privacy` load while **logged out**; gate links open the docs in a new tab without leaving the gate; bumping `CURRENT_TERMS_VERSION` locally re-shows the gate for a previously-accepted user.
- **Accessibility (manual + axe):** dialog has an accessible name and traps focus; checkbox is keyboard-operable and labelled; focus visible; AA contrast; content pages have a correct heading outline and reflow.

## What Does Not Change

- Auth mechanism, billing/Stripe, scanning, profiles, lists, sharing — untouched. The gate only wraps route rendering after auth.
- The inline scan-screen disclaimers stay as-is (the gate complements them).

## Out of Scope (later / YAGNI)

- The **authoritative legal copy** — the ToS here is a clearly-labeled starter the owner must finalize; the Privacy Policy is owner-generated.
- Analytics/audit trail of acceptances beyond the single stored doc.
- Multi-language terms.
- A cookie/consent banner.
- Footer redesign — `/terms` and `/privacy` become linkable, but a full footer/settings layout is separate (landing-page work).
- Per-document granular consent (separate ToS vs Privacy checkboxes) — one combined checkbox.
