# Monetization — Stripe Paywall & Domain Migration Design Spec

**Date:** 2026-06-19
**Status:** Approved

## Overview

Add a $5/month subscription paywall with 10 free scans, Stripe Checkout for payments, and migrate the app to the new `ingredientscan.app` domain.

## Design Decisions

| Question | Decision |
|----------|----------|
| Free tier | 10 scans lifetime (not monthly reset) |
| Paywall trigger | Home screen shows counter; tapping Scan at limit shows full-screen upgrade page |
| Upgrade screen | Full-screen page with feature list + Stripe Checkout button |
| Payment processor | Stripe (Apple Pay + Google Pay built in, no card data on server) |
| Price | $5/month |
| Subscription management | Stripe Customer Portal (no custom UI) |
| Scan count enforcement | Server-side — Railway verifies Firebase auth token + checks Firestore on every scan |
| Domain | ingredientscan.app (purchased 2026-06-19), replacing scanner.joelrog.com |

---

## Data Model

Firestore at `users/{uid}/billing/info` (single document per user):

```js
{
  scanCount: number,           // lifetime scans used (incremented server-side only)
  subscriptionStatus: 'free' | 'active' | 'cancelled',
  stripeCustomerId: string,    // set on first checkout
  stripeSubscriptionId: string // set on subscription activation
}
```

**Cancellation behavior:** The 10 free scans are a lifetime trial, not a monthly allowance. `scanCount` is never reset — if a user subscribes, uses 200 scans, then cancels, they have 0 free scans remaining and must resubscribe to continue scanning.

**Security:** Clients can READ their own billing document but cannot WRITE it. Only the server (Firebase Admin SDK) writes `scanCount` and `subscriptionStatus`. This prevents a client from zeroing their scan count to bypass the paywall.

The existing wildcard Firestore rule (`{document=**}`) must be replaced with explicit per-collection rules so the `billing` subcollection stays client-write-protected:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/scans/{scanId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/allergens/{allergenId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/billing/{document} {
      allow read: if request.auth != null && request.auth.uid == userId;
      // write blocked — server uses Admin SDK which bypasses rules
    }
  }
}
```

---

## Architecture

### Scan enforcement flow

Every scan request (label and barcode) now requires a Firebase auth token:

1. Client sends `Authorization: Bearer <firebaseIdToken>` with each scan request
2. Railway server verifies token via Firebase Admin SDK
3. Server reads `users/{uid}/profile` from Firestore
4. If `subscriptionStatus !== 'active'` AND `scanCount >= 10` → return `403 { error: 'scan_limit_reached' }`
5. If allowed → process scan → increment `scanCount` in Firestore → return result

### Stripe checkout flow

1. User taps "Upgrade — $5/month" on the upgrade screen
2. Client calls `POST /stripe/create-checkout-session` with the user's Firebase auth token
3. Server creates a Stripe Checkout Session with:
   - `success_url`: `https://ingredientscan.app/upgrade/success`
   - `cancel_url`: `https://ingredientscan.app/upgrade`
   - `customer_email`: from the verified Firebase token
   - Stores `stripeCustomerId` on the Firestore user profile
4. Client receives `{ url }` and redirects to Stripe's hosted checkout page
5. Stripe handles payment (Apple Pay / Google Pay / card)
6. On success: Stripe redirects to `/upgrade/success`

### Webhook flow

Stripe sends events to `POST /stripe/webhook` on Railway:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `subscriptionStatus: 'active'`, store `stripeSubscriptionId` |
| `customer.subscription.deleted` | Set `subscriptionStatus: 'cancelled'` |
| `invoice.payment_failed` | Set `subscriptionStatus: 'cancelled'` |

Webhook endpoint validates Stripe signature before processing.

### Subscription management

A "Manage subscription" link in the home screen footer calls `POST /stripe/customer-portal` → server creates a Stripe Customer Portal session → client redirects to Stripe's hosted portal (cancel, update payment method, view invoices).

---

## New Server Routes

**`POST /stripe/create-checkout-session`**
- Auth: Firebase token required
- Creates Stripe Checkout Session for $5/month subscription
- Returns `{ url: string }`

**`POST /stripe/webhook`**
- Auth: Stripe signature header (no Firebase token)
- Handles subscription lifecycle events
- Updates Firestore user profile

**`POST /stripe/customer-portal`**
- Auth: Firebase token required
- Creates Stripe Customer Portal session
- Returns `{ url: string }`

---

## Frontend Changes

### `web/src/api.js`
- Add `Authorization: Bearer <token>` header to all scan requests
- Add `createCheckoutSession()` and `createCustomerPortalSession()` helper functions

### `web/src/App.jsx`
- Add `/upgrade` route → `UpgradeScreen`
- Add `/upgrade/success` route → brief success screen, then navigate home
- Pass user's Firebase ID token down to scan API calls

### `web/src/HomeScreen.jsx`
- Add scan counter banner for free users: "X of 10 free scans used" + progress bar
- Hidden for `subscriptionStatus === 'active'`
- Add "Manage subscription" link in footer for subscribed users
- Tapping Scan when `scanCount >= 10` → navigate to `/upgrade` instead of `/scan`

### New: `web/src/UpgradeScreen.jsx` + `UpgradeScreen.css`
- Full-screen page with back button
- Feature list: unlimited scans, personal allergen tracking, full scan history
- "Upgrade — $5/month" button → calls `createCheckoutSession()` → redirects to Stripe
- "Cancel anytime · Secure payment via Stripe" subtext
- Loading state while session is being created

### New: `web/src/UpgradeSuccessScreen.jsx`
- Simple "You're all set! 🎉" confirmation screen
- Auto-navigates to `/home` after 2 seconds (or tap to continue)

---

## Domain Migration

As part of this build, migrate from `scanner.joelrog.com` to `ingredientscan.app`:

1. **Firebase Hosting**: Add `ingredientscan.app` as a custom domain, verify DNS
2. **Railway `auth.js`**: Update `FRONTEND_URL` constant to `https://ingredientscan.app`
3. **Railway env vars**: Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
4. **Stripe dashboard**: Set success/cancel URLs and webhook endpoint to `ingredientscan.app`
5. **CORS**: Update server CORS to allow both domains during transition

`scanner.joelrog.com` remains active during transition so existing users aren't broken.

---

## Stripe Setup (Prerequisites — manual, before implementation)

1. Create Stripe account at stripe.com
2. Create a Product: "Ingredient Scanner" with a recurring Price of $5/month → copy the Price ID
3. Register webhook endpoint: `https://ingredientscan.app/stripe/webhook` → copy webhook signing secret
4. Add to Railway environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID`

---

## What Does Not Change

- Firebase Auth (Google sign-in flow unchanged)
- Firestore scan storage schema (`users/{uid}/scans/{scanId}`)
- Allergen feature
- Label scanning logic (Google Vision)
- Barcode scanning logic (ZXing)
- History screen
- Railway deployment process

---

## Scalability Notes

- Railway: upgrade to Pro plan for auto-scaling when daily active users grow
- Open Food Facts: cache barcode lookups in Firestore to avoid repeat API calls at scale
- Google Vision: cost scales linearly with label scans (~$1.50/1,000); track monthly
