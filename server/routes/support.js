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
