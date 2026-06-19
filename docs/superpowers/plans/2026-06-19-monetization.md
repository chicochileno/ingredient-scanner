# Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a $5/month Stripe subscription with 10 free lifetime scans, a full-screen paywall, scan counter on the home screen, and migrate the app to ingredientscan.app.

**Architecture:** Scan limits are enforced server-side — every scan request now requires a Firebase ID token, and Railway checks Firestore billing state before processing. Stripe Checkout handles payment on a hosted page; webhooks update Firestore subscription status. The frontend reads billing state via a Firestore `onSnapshot` listener exposed through `BillingContext`.

**Tech Stack:** React 18, Express/Node on Railway, Firestore, Firebase Auth, Stripe Node SDK, Firebase Hosting custom domain

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `firestore.rules` | Replace wildcard with per-collection rules; billing is client-read-only |
| Create | `server/utils/firebaseAdmin.js` | Singleton Firebase Admin init shared across routes |
| Create | `server/utils/billing.js` | getBilling, incrementScanCount, updateBilling helpers |
| Create | `server/middleware/requireAuth.js` | Verify Firebase ID token, attach req.uid |
| Create | `server/routes/stripe.js` | Checkout session, webhook, customer portal routes |
| Modify | `server/routes/auth.js` | Import shared firebaseAdmin instead of inline init |
| Modify | `server/routes/scan.js` | Add requireAuth + billing enforcement to all scan routes |
| Modify | `server/index.js` | Register stripe routes; mount webhook before JSON parser |
| Modify | `web/src/api.js` | Add auth token to scan requests; add Stripe helpers |
| Create | `web/src/useBilling.js` | Firestore billing hook + BillingContext |
| Create | `web/src/UpgradeScreen.jsx` | Full-screen paywall + success screen |
| Create | `web/src/UpgradeScreen.css` | Styles for upgrade + success screens |
| Modify | `web/src/App.jsx` | Add BillingContext, /upgrade and /upgrade/success routes |
| Modify | `web/src/HomeScreen.jsx` | Scan counter, block at limit, manage subscription link |
| Modify | `web/src/HomeScreen.css` | Scan counter styles |

---

## Task 1: Update Firestore rules

**Files:**
- Modify: `firestore.rules`

Replace the existing wildcard rule with specific per-collection rules. The `billing` subcollection is client-read-only — the server writes it via Firebase Admin SDK which bypasses rules.

- [ ] **Step 1: Replace `firestore.rules` content**

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
    }
  }
}
```

- [ ] **Step 2: Deploy rules manually in Firebase Console**

Go to [console.firebase.google.com](https://console.firebase.google.com) → **ingredient-scanner-app-c9206** → **Firestore Database** → **Rules** tab → paste the new rules → **Publish**.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Tighten Firestore rules: billing subcollection is server-write-only"
```

---

## Task 2: Stripe account setup (manual walkthrough)

> **This task requires the human.** No code to write — follow these steps in the Stripe dashboard.

- [ ] **Step 1: Create Stripe account**

Go to [stripe.com](https://stripe.com) → Sign up → complete onboarding. You can use Test Mode while building.

- [ ] **Step 2: Create the subscription product**

Dashboard → **Products** → **+ Add product**:
- Name: `Ingredient Scanner`
- Pricing: **Recurring**, $5.00 USD / month
- Click **Save product**
- Copy the **Price ID** (starts with `price_...`) — you'll need it shortly

- [ ] **Step 3: Get your API keys**

Dashboard → **Developers** → **API keys**:
- Copy **Secret key** (starts with `sk_test_...` in test mode)

- [ ] **Step 4: Register the webhook endpoint**

Dashboard → **Developers** → **Webhooks** → **+ Add endpoint**:
- Endpoint URL: `https://precious-acceptance-production.up.railway.app/stripe/webhook`
  (update to the Railway URL — check your Railway dashboard if unsure)
- Events to listen for: select these three:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Click **Add endpoint**
- Click **Reveal** next to **Signing secret** and copy it (starts with `whsec_...`)

- [ ] **Step 5: Add env vars to Railway**

Railway dashboard → your service → **Variables** → add:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
FRONTEND_URL=https://ingredientscan.app
```

> **Note:** `FRONTEND_URL` replaces the hardcoded value in `auth.js`. During development before the domain is live, set it to `https://scanner.joelrog.com`.

---

## Task 3: Shared Firebase Admin + billing utilities

**Files:**
- Create: `server/utils/firebaseAdmin.js`
- Create: `server/utils/billing.js`
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Create `server/utils/firebaseAdmin.js`**

```js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

module.exports = admin;
```

- [ ] **Step 2: Create `server/utils/billing.js`**

```js
const admin = require('./firebaseAdmin');

function billingRef(uid) {
  return admin.firestore().collection('users').doc(uid).collection('billing').doc('info');
}

async function getBilling(uid) {
  const snap = await billingRef(uid).get();
  if (!snap.exists) return { scanCount: 0, subscriptionStatus: 'free' };
  return snap.data();
}

async function incrementScanCount(uid) {
  await billingRef(uid).set(
    { scanCount: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );
}

async function updateBilling(uid, fields) {
  await billingRef(uid).set(fields, { merge: true });
}

module.exports = { getBilling, incrementScanCount, updateBilling };
```

- [ ] **Step 3: Update `server/routes/auth.js` to use shared Firebase Admin**

Remove the inline Firebase Admin initialization block (lines 4–12 in auth.js — the `if (!admin.apps.length)` block). Replace the `require('firebase-admin')` line at the top with:

```js
const admin = require('../utils/firebaseAdmin');
```

Keep everything else in `auth.js` unchanged.

- [ ] **Step 4: Verify server still starts**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/server && node index.js
```

Expected: `Server v2.0 running on port 3001` with no errors. Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add server/utils/firebaseAdmin.js server/utils/billing.js server/routes/auth.js
git commit -m "Extract Firebase Admin to shared util; add billing helpers"
```

---

## Task 4: requireAuth middleware

**Files:**
- Create: `server/middleware/requireAuth.js`

- [ ] **Step 1: Create `server/middleware/requireAuth.js`**

```js
const admin = require('../utils/firebaseAdmin');

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware/requireAuth.js
git commit -m "Add requireAuth middleware for Firebase token verification"
```

---

## Task 5: Stripe routes

**Files:**
- Create: `server/routes/stripe.js`
- Modify: `server/index.js`

- [ ] **Step 1: Install Stripe SDK**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/server && npm install stripe
```

- [ ] **Step 2: Create `server/routes/stripe.js`**

```js
const express = require('express');
const Stripe = require('stripe');
const admin = require('../utils/firebaseAdmin');
const requireAuth = require('../middleware/requireAuth');
const { getBilling, updateBilling } = require('../utils/billing');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /stripe/create-checkout-session
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const billing = await getBilling(req.uid);

    let customerId = billing.stripeCustomerId;
    if (!customerId) {
      const userRecord = await admin.auth().getUser(req.uid);
      const customer = await stripe.customers.create({
        email: userRecord.email,
        metadata: { firebaseUid: req.uid },
      });
      customerId = customer.id;
      await updateBilling(req.uid, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      // omitting payment_method_types lets Stripe auto-show Apple Pay / Google Pay
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/upgrade/success`,
      cancel_url: `${process.env.FRONTEND_URL}/upgrade`,
      metadata: { firebaseUid: req.uid },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /stripe/customer-portal
router.post('/customer-portal', requireAuth, async (req, res) => {
  try {
    const billing = await getBilling(req.uid);
    if (!billing.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/home`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Customer portal error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook handler — exported separately so it can be mounted before express.json()
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata.firebaseUid;
        if (uid) {
          await updateBilling(uid, {
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const customerId = event.data.object.customer;
        const snap = await admin.firestore()
          .collectionGroup('billing')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();
        if (!snap.empty) {
          await snap.docs[0].ref.set({ subscriptionStatus: 'cancelled' }, { merge: true });
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
```

- [ ] **Step 3: Update `server/index.js`**

Replace the entire file with:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scanRoutes = require('./routes/scan');
const authRoutes = require('./routes/auth');
const { router: stripeRouter, webhookHandler } = require('./routes/stripe');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'https://ingredientscan.app',
  'https://scanner.joelrog.com',
  'http://localhost:5173',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));

// Stripe webhook must receive raw body — mount BEFORE express.json()
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json({ limit: '10mb' }));

app.use('/scan', scanRoutes);
app.use('/auth', authRoutes);
app.use('/stripe', stripeRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', version: '3.0', routes: ['scan', 'auth', 'stripe'] }));

app.listen(PORT, () => {
  console.log(`Server v3.0 running on port ${PORT}`);
});
```

- [ ] **Step 4: Verify server starts cleanly**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/server && node index.js
```

Expected: `Server v3.0 running on port 3001` with no errors. Ctrl+C to stop.

- [ ] **Step 5: Enable Apple Pay and Google Pay in Stripe dashboard**

Stripe Dashboard → **Settings** → **Payment methods** → enable **Apple Pay** and **Google Pay**.
Apple Pay also requires domain registration: **Settings** → **Apple Pay** → **Add new domain** → `ingredientscan.app`.

- [ ] **Step 6: Commit**

```bash
git add server/routes/stripe.js server/index.js server/package.json server/package-lock.json
git commit -m "Add Stripe checkout, webhook, and customer portal routes"
```

---

## Task 6: Update scan routes to enforce billing limit

**Files:**
- Modify: `server/routes/scan.js`

Add `requireAuth` middleware to all three scan endpoints. Before processing, check billing. After success, increment scan count.

- [ ] **Step 1: Add imports at top of `server/routes/scan.js`**

After the existing requires, add:

```js
const requireAuth = require('../middleware/requireAuth');
const { getBilling, incrementScanCount } = require('../utils/billing');
```

- [ ] **Step 2: Add billing check helper inside scan.js**

After the imports, add:

```js
async function checkScanLimit(uid) {
  const billing = await getBilling(uid);
  if (billing.subscriptionStatus !== 'active' && billing.scanCount >= 10) {
    return false;
  }
  return true;
}
```

- [ ] **Step 3: Update `POST /scan/image` route**

Replace:
```js
router.post('/image', async (req, res) => {
```
With:
```js
router.post('/image', requireAuth, async (req, res) => {
```

Add billing check immediately after the `apiKey` check (before the Vision API call):

```js
  const allowed = await checkScanLimit(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });
```

Add `await incrementScanCount(req.uid);` before each `res.json(...)` that returns a successful result. There are two success paths in `/image`:
1. The barcode path (`return res.json({ productName, imageUrl, upc, rawText: rawIngredients, ... })`)
2. The label path (`res.json({ rawText, flagged, ingredientCount: flagged.length })`)

Add `await incrementScanCount(req.uid);` before each of those two lines. Also add it before the "no ingredients" early return in barcode mode:
```js
// Before: return res.json({ productName, imageUrl, upc, rawText: '', flagged: [], ingredientCount: 0 });
await incrementScanCount(req.uid);
return res.json({ productName, imageUrl, upc, rawText: '', flagged: [], ingredientCount: 0 });
```

- [ ] **Step 4: Update `GET /scan/barcode/:upc` route**

Replace:
```js
router.get('/barcode/:upc', async (req, res) => {
```
With:
```js
router.get('/barcode/:upc', requireAuth, async (req, res) => {
```

Add billing check at the top of the handler (after `const { upc } = req.params;`):

```js
  const allowed = await checkScanLimit(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });
```

Add `await incrementScanCount(req.uid);` before the success `res.json(...)` calls (both the "no ingredients" early return and the full result).

- [ ] **Step 5: Verify the full updated `server/routes/scan.js`**

The file should look like this after all edits:

```js
const express = require('express');
const axios = require('axios');
const { matchIngredients } = require('../utils/ingredientMatcher');
const requireAuth = require('../middleware/requireAuth');
const { getBilling, incrementScanCount } = require('../utils/billing');

const router = express.Router();

function extractIngredientsSection(text) {
  const match = text.match(/ingredients?\s*:?\s*/i);
  if (!match) return text;
  const start = match.index + match[0].length;
  const remainder = text.slice(start);
  const endMatch = remainder.search(
    /\b(contains\s*:|manufactured\s+(in|by)|distributed\s+by|produced\s+by|packed\s+by|calories|serving\s+size|amount\s+per|nutrition\s+facts|percent\s+daily)\b/i
  );
  const extracted = endMatch !== -1 ? remainder.slice(0, endMatch) : remainder;
  return extracted.trim() || text;
}

function extractBarcode(text) {
  const matches = text.match(/\b\d{8,14}\b/g);
  if (!matches) return null;
  const preferred = matches.find((m) => m.length === 12 || m.length === 13);
  return preferred || matches[0];
}

async function checkScanLimit(uid) {
  const billing = await getBilling(uid);
  if (billing.subscriptionStatus !== 'active' && billing.scanCount >= 10) return false;
  return true;
}

router.post('/image', requireAuth, async (req, res) => {
  const { imageBase64, detectBarcode } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Vision API key not configured' });

  const allowed = await checkScanLimit(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });

  try {
    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }
    );

    const annotations = visionRes.data.responses[0];

    if (detectBarcode) {
      const rawText = annotations?.fullTextAnnotation?.text || '';
      const upc = extractBarcode(rawText);
      if (!upc) {
        return res.status(422).json({ error: 'No barcode found in image. Try again with the barcode centered and well-lit.' });
      }
      const offRes = await axios.get(
        `https://world.openfoodfacts.org/api/v0/product/${upc}.json`,
        { timeout: 8000 }
      );
      if (offRes.data.status === 0) {
        return res.status(404).json({ error: `Barcode ${upc} not found in Open Food Facts database.` });
      }
      const product = offRes.data.product;
      const productName = product.product_name || 'Unknown Product';
      const rawIngredients = product.ingredients_text || '';
      const imageUrl = product.image_url || null;
      if (!rawIngredients) {
        await incrementScanCount(req.uid);
        return res.json({ productName, imageUrl, upc, rawText: '', flagged: [], ingredientCount: 0 });
      }
      const flagged = matchIngredients(rawIngredients);
      await incrementScanCount(req.uid);
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
    }

    if (!annotations || !annotations.fullTextAnnotation) {
      return res.json({ rawText: '', flagged: [], ingredientCount: 0 });
    }

    const rawText = annotations.fullTextAnnotation.text;
    const ingredientsText = extractIngredientsSection(rawText);
    const flagged = matchIngredients(ingredientsText);
    await incrementScanCount(req.uid);
    res.json({ rawText, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Vision API error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.post('/text', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const flagged = matchIngredients(text);
  res.json({ rawText: text, flagged, ingredientCount: flagged.length });
});

router.get('/barcode/:upc', requireAuth, async (req, res) => {
  const { upc } = req.params;

  const allowed = await checkScanLimit(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });

  try {
    const offRes = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${upc}.json`,
      { timeout: 8000 }
    );
    if (offRes.data.status === 0) {
      return res.status(404).json({ error: 'Product not found in Open Food Facts database' });
    }
    const product = offRes.data.product;
    const productName = product.product_name || 'Unknown Product';
    const rawIngredients = product.ingredients_text || '';
    const imageUrl = product.image_url || null;
    if (!rawIngredients) {
      await incrementScanCount(req.uid);
      return res.json({ productName, imageUrl, rawText: '', flagged: [], ingredientCount: 0 });
    }
    const flagged = matchIngredients(rawIngredients);
    await incrementScanCount(req.uid);
    res.json({ productName, imageUrl, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Open Food Facts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product data' });
  }
});

module.exports = router;
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/scan.js
git commit -m "Enforce scan limit server-side; require Firebase auth token on all scan routes"
```

---

## Task 7: Frontend — update `api.js`

**Files:**
- Modify: `web/src/api.js`

- [ ] **Step 1: Replace `web/src/api.js` entirely**

```js
import { auth } from './firebase';

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function scanImage(imageBase64) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64 }),
  }));
}

export async function scanBarcode(upc) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/barcode/${upc}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  }));
}

export async function createCheckoutSession() {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }));
}

export async function createCustomerPortalSession() {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/stripe/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api.js
git commit -m "Add auth token to scan requests; add Stripe API helpers"
```

---

## Task 8: Frontend — `useBilling` hook + `BillingContext`

**Files:**
- Create: `web/src/useBilling.js`

- [ ] **Step 1: Create `web/src/useBilling.js`**

```js
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const BillingContext = createContext({
  scanCount: 0,
  subscriptionStatus: 'free',
  loading: true,
});

export function useBillingContext() {
  return useContext(BillingContext);
}

export function useBilling(user) {
  const [billing, setBilling] = useState({ scanCount: 0, subscriptionStatus: 'free', loading: true });

  useEffect(() => {
    if (!user) {
      setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
      return;
    }
    const ref = doc(db, 'users', user.uid, 'billing', 'info');
    const unsub = onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          setBilling({ ...snap.data(), loading: false });
        } else {
          setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
        }
      },
      err => {
        console.error('Failed to load billing:', err);
        setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
      }
    );
    return unsub;
  }, [user?.uid]);

  return billing;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/useBilling.js
git commit -m "Add useBilling hook and BillingContext for Firestore-backed subscription state"
```

---

## Task 9: Frontend — `UpgradeScreen` + `UpgradeSuccessScreen`

**Files:**
- Create: `web/src/UpgradeScreen.jsx`
- Create: `web/src/UpgradeScreen.css`

- [ ] **Step 1: Create `web/src/UpgradeScreen.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession } from './api';
import './UpgradeScreen.css';

export function UpgradeScreen({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="upgrade-root">
      <button className="upgrade-back" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      <div className="upgrade-content">
        <div className="upgrade-icon">🌿</div>
        <h1 className="upgrade-title">Upgrade to<br />Unlimited</h1>
        <p className="upgrade-sub">
          You've used your 10 free scans.<br />
          Keep scanning for $5/month.
        </p>

        <div className="upgrade-features">
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Unlimited scans</p>
              <p className="upgrade-feature-desc">Scan as many products as you need</p>
            </div>
          </div>
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Personal allergen tracking</p>
              <p className="upgrade-feature-desc">Flag your custom ingredients in every scan</p>
            </div>
          </div>
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Full scan history</p>
              <p className="upgrade-feature-desc">Review all past scans anytime</p>
            </div>
          </div>
        </div>

        {error && <p className="upgrade-error">{error}</p>}

        <button
          className="upgrade-btn"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? <span className="upgrade-spinner" /> : 'Upgrade — $5/month'}
        </button>
        <p className="upgrade-legal">Cancel anytime · Secure payment via Stripe</p>
      </div>
    </div>
  );
}

export function UpgradeSuccessScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/home', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="upgrade-root upgrade-success-root">
      <div className="upgrade-content">
        <div className="upgrade-icon">🎉</div>
        <h1 className="upgrade-title">You're all set!</h1>
        <p className="upgrade-sub">Your subscription is active.<br />Scan unlimited products.</p>
        <button className="upgrade-btn" onClick={() => navigate('/home', { replace: true })}>
          Start scanning
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/UpgradeScreen.css`**

```css
.upgrade-root {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top, 52px) 0 env(safe-area-inset-bottom, 32px);
}

.upgrade-back {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--sage);
  cursor: pointer;
  padding: 12px 20px;
  min-height: 44px;
  align-self: flex-start;
}

.upgrade-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 28px 24px;
  text-align: center;
}

.upgrade-success-root .upgrade-content {
  justify-content: center;
  padding-top: 0;
}

.upgrade-icon {
  font-size: 52px;
  margin-bottom: 16px;
}

.upgrade-title {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.5px;
  line-height: 1.15;
  margin-bottom: 10px;
}

.upgrade-sub {
  font-size: 15px;
  color: var(--ink-2);
  line-height: 1.6;
  margin-bottom: 28px;
}

.upgrade-features {
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 6px 0;
  margin-bottom: 28px;
  text-align: left;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.upgrade-feature {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
}
.upgrade-feature:last-child { border-bottom: none; }

.upgrade-check {
  color: var(--sage);
  font-size: 16px;
  font-weight: 700;
  margin-top: 1px;
  flex-shrink: 0;
}

.upgrade-feature-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 2px;
}

.upgrade-feature-desc {
  font-size: 12px;
  color: var(--ink-3);
}

.upgrade-error {
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 12px;
}

.upgrade-btn {
  width: 100%;
  padding: 16px;
  background: var(--sage);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.upgrade-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.upgrade-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: block;
}

.upgrade-legal {
  font-size: 12px;
  color: var(--ink-3);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/UpgradeScreen.jsx web/src/UpgradeScreen.css
git commit -m "Add UpgradeScreen paywall and UpgradeSuccessScreen"
```

---

## Task 10: Frontend — update `App.jsx`

**Files:**
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Add imports**

Add after existing imports:

```js
import { useBilling, BillingContext } from './useBilling';
import { UpgradeScreen, UpgradeSuccessScreen } from './UpgradeScreen';
```

- [ ] **Step 2: Call `useBilling` in `AppRoutes` and provide context**

Inside `AppRoutes`, directly after `const allergenAPI = useAllergens(user);`, add:

```js
const billing = useBilling(user);
```

Wrap both return paths (loading spinner and Routes) with `BillingContext.Provider`, nested inside the existing `AllergenContext.Provider`:

```jsx
// Loading spinner return:
return (
  <AllergenContext.Provider value={allergenAPI}>
    <BillingContext.Provider value={billing}>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--sage)', display: 'block', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </BillingContext.Provider>
  </AllergenContext.Provider>
);

// Routes return:
return (
  <AllergenContext.Provider value={allergenAPI}>
    <BillingContext.Provider value={billing}>
      <Routes>
        {/* all existing routes */}
      </Routes>
    </BillingContext.Provider>
  </AllergenContext.Provider>
);
```

- [ ] **Step 3: Add /upgrade and /upgrade/success routes**

Inside `<Routes>`, after the `/allergens` route, add:

```jsx
<Route
  path="/upgrade"
  element={
    <RequireAuth user={user} authReady={authReady}>
      <UpgradeScreen onBack={() => navigate('/home')} />
    </RequireAuth>
  }
/>
<Route
  path="/upgrade/success"
  element={
    <RequireAuth user={user} authReady={authReady}>
      <UpgradeSuccessScreen />
    </RequireAuth>
  }
/>
```

- [ ] **Step 4: Update `HomeRoute` to pass `onUpgrade`**

Replace the `HomeRoute` component:

```jsx
function HomeRoute({ user, onScan, onHistory, onAllergens, onUpgrade }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onAllergens={onAllergens} onUpgrade={onUpgrade} />;
}
```

Update the `/home` route:

```jsx
<Route
  path="/home"
  element={
    <RequireAuth user={user} authReady={authReady}>
      <HomeRoute
        user={user}
        onScan={() => navigate('/scan')}
        onHistory={() => navigate('/history')}
        onAllergens={() => navigate('/allergens')}
        onUpgrade={() => navigate('/upgrade')}
      />
    </RequireAuth>
  }
/>
```

- [ ] **Step 5: Commit**

```bash
git add web/src/App.jsx
git commit -m "Wire BillingContext and /upgrade routes in App"
```

---

## Task 11: Frontend — update `HomeScreen.jsx` + `HomeScreen.css`

**Files:**
- Modify: `web/src/HomeScreen.jsx`
- Modify: `web/src/HomeScreen.css`

- [ ] **Step 1: Add import to `HomeScreen.jsx`**

Add after existing imports:

```js
import { useBillingContext } from './useBilling';
import { createCustomerPortalSession } from './api';
```

- [ ] **Step 2: Update `HomeScreen` function**

Replace the function signature:
```jsx
export default function HomeScreen({ user, onScan, onHistory, onAllergens, onUpgrade }) {
```

Inside the function body, after `const { allergens } = useAllergenContext();`, add:

```js
const { scanCount, subscriptionStatus, loading: billingLoading } = useBillingContext();
const isSubscribed = subscriptionStatus === 'active';
const atLimit = !isSubscribed && scanCount >= 10;

async function handleManageSubscription() {
  try {
    const { url } = await createCustomerPortalSession();
    window.location.href = url;
  } catch {
    // silently fail — user can manage at stripe.com
  }
}
```

- [ ] **Step 3: Update the Scan card click handler**

Change the Scan card from:
```jsx
<button className="home-card home-card-scan" onClick={onScan}>
```
To:
```jsx
<button className="home-card home-card-scan" onClick={atLimit ? onUpgrade : onScan}>
```

- [ ] **Step 4: Add scan counter banner after the cards section**

After `</div>` closing the `home-cards` div, add:

```jsx
{!isSubscribed && !billingLoading && (
  <div className="scan-counter">
    <div className="scan-counter-row">
      <span className="scan-counter-label">
        {atLimit ? 'Free scans used up' : `${scanCount} of 10 free scans used`}
      </span>
      <button className="scan-counter-upgrade" onClick={onUpgrade}>
        Upgrade
      </button>
    </div>
    <div className="scan-counter-bar">
      <div
        className="scan-counter-fill"
        style={{ width: `${Math.min((scanCount / 10) * 100, 100)}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 5: Update footer to show "Manage subscription" for subscribed users**

Replace the footer section:

```jsx
<div className="home-footer">
  {isSubscribed && (
    <button className="home-footer-btn" onClick={handleManageSubscription}>
      Manage subscription
    </button>
  )}
  <button className="home-footer-btn" onClick={() => setShowAbout(true)}>
    How are ingredients flagged?
  </button>
</div>
```

- [ ] **Step 6: Add CSS to `HomeScreen.css`**

Append to the end of `HomeScreen.css`:

```css
/* Scan counter */
.scan-counter {
  margin: 0 0 4px;
  animation: fadeUp 0.35s 0.1s ease both;
}

.scan-counter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.scan-counter-label {
  font-size: 12px;
  color: var(--ink-3);
  font-weight: 500;
}

.scan-counter-upgrade {
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--sage);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.scan-counter-bar {
  height: 5px;
  background: var(--border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.scan-counter-fill {
  height: 100%;
  background: var(--sage);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}
```

- [ ] **Step 7: Handle `scan_limit_reached` in `ScanScreen.jsx`**

If the user is already on the scan screen when they hit the limit (e.g. ZXing decodes a barcode while billing state is still loading), the API returns `'scan_limit_reached'` and the raw string shows as an error. Fix it to navigate to /upgrade instead.

In `web/src/ScanScreen.jsx`, add `useNavigate` to the import:
```js
import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
```

Add inside the component (after the existing state declarations):
```js
const navigate = useNavigate();
```

In the ZXing barcode scanning `useEffect`, update the catch block:
```js
} catch (e) {
  if (e.message === 'scan_limit_reached') {
    navigate('/upgrade');
    return;
  }
  setError(e.message);
  setLoading(false);
  triggered = false;
}
```

In `handleCapture`, update the catch block:
```js
} catch (e) {
  if (e.message === 'scan_limit_reached') {
    navigate('/upgrade');
    return;
  }
  setError(e.message);
} finally {
  setLoading(false);
}
```

- [ ] **Step 8: Commit ScanScreen fix**

```bash
git add web/src/ScanScreen.jsx
git commit -m "Navigate to /upgrade on scan_limit_reached in ScanScreen"
```

- [ ] **Step 9: Verify in browser**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/web && npm run dev
```

Sign in → home screen should show "0 of 10 free scans used" with a progress bar. Scan counter should update after each scan. At 10 scans, the Scan card tap should navigate to /upgrade.

- [ ] **Step 10: Commit**

```bash
git add web/src/HomeScreen.jsx web/src/HomeScreen.css
git commit -m "Add scan counter and paywall gate to home screen"
```

---

## Task 12: Domain migration

**Files:**
- Modify: `server/routes/auth.js` (remove hardcoded FRONTEND_URL)

**Part A — Firebase Hosting custom domain (manual)**

- [ ] **Step 1: Add custom domain in Firebase Console**

Firebase Console → **ingredient-scanner-app-c9206** → **Hosting** → **Add custom domain**:
- Domain: `ingredientscan.app`
- Follow the DNS verification steps (Firebase will show you TXT and A records to add)

- [ ] **Step 2: Add DNS records at your registrar**

In your domain registrar's DNS settings, add the records Firebase gives you:
- TXT record for domain verification
- A records pointing `ingredientscan.app` to Firebase's IP addresses
- A records pointing `www.ingredientscan.app` to Firebase's IPs (optional but recommended)

DNS propagation takes 5–30 minutes. Firebase Hosting shows "Connected" when complete.

**Part B — Railway env var (already done in Task 2)**

You set `FRONTEND_URL=https://ingredientscan.app` in Railway env vars during Task 2 Step 5.

**Part C — Remove hardcoded URL from auth.js**

- [ ] **Step 3: Update `server/routes/auth.js`**

Replace:
```js
const CALLBACK_URL = 'https://precious-acceptance-production.up.railway.app/auth/google/callback';
const FRONTEND_URL = 'https://scanner.joelrog.com';
```
With:
```js
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://precious-acceptance-production.up.railway.app/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scanner.joelrog.com';
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js
git commit -m "Use env vars for FRONTEND_URL and CALLBACK_URL in auth route"
```

---

## Task 13: Deploy

- [ ] **Step 1: Push to GitHub (triggers Firebase frontend deploy)**

```bash
git push
```

- [ ] **Step 2: Check GitHub Actions**

```bash
gh run list --limit 1
```

Expected: `completed success`

- [ ] **Step 3: Deploy backend to Railway**

```bash
cd /Users/joelrogers/Sandbox/barcode-scan-app/server && railway up --detach
```

- [ ] **Step 4: Verify health endpoint**

```bash
curl https://precious-acceptance-production.up.railway.app/health
```

Expected: `{"status":"ok","version":"3.0","routes":["scan","auth","stripe"]}`

- [ ] **Step 5: Test Stripe checkout end-to-end (in Stripe test mode)**

1. Open `https://ingredientscan.app` (or `https://scanner.joelrog.com` while DNS propagates)
2. Sign in and do 10 scans
3. Tap Scan on the 11th — should navigate to /upgrade
4. Tap "Upgrade — $5/month" — should redirect to Stripe Checkout
5. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
6. Complete payment — should redirect to /upgrade/success
7. Home screen should show no scan counter (subscribed)
8. Scan should work without limit

- [ ] **Step 6: Switch Stripe to live mode when ready**

Dashboard → toggle from **Test** to **Live** → get live API keys → update Railway env vars with live keys → redeploy.
