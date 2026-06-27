const express = require('express');
const Stripe = require('stripe');
const admin = require('../utils/firebaseAdmin');
const requireAuth = require('../middleware/requireAuth');
const { getBilling, updateBilling } = require('../utils/billing');

const router = express.Router();

// Lazy-initialize so the module loads even when STRIPE_SECRET_KEY is absent locally
let _stripe;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// POST /stripe/create-checkout-session
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const billing = await getBilling(req.uid);

    let customerId = billing.stripeCustomerId;
    if (!customerId) {
      const userRecord = await admin.auth().getUser(req.uid);
      const customer = await getStripe().customers.create({
        email: userRecord.email,
        metadata: { firebaseUid: req.uid },
      });
      customerId = customer.id;
      await updateBilling(req.uid, { stripeCustomerId: customerId });
    }

    const session = await getStripe().checkout.sessions.create({
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
    const session = await getStripe().billingPortal.sessions.create({
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
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
