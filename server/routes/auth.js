const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');

const router = express.Router();

const CALLBACK_URL = 'https://precious-acceptance-production.up.railway.app/auth/google/callback';
const FRONTEND_URL = 'https://ingredient-scanner-app-c9206.web.app';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

function getOAuthClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL
  );
}

// GET /auth/google — redirect to Google sign-in
router.get('/google', (req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

// GET /auth/google/callback — exchange code, create Firebase custom token, redirect to app
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/?authError=cancelled`);
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify the ID token and get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const uid = `google_${payload.sub}`;

    // Create a Firebase custom token for this user
    const customToken = await admin.auth().createCustomToken(uid, {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

    res.redirect(`${FRONTEND_URL}/?firebaseToken=${customToken}`);
  } catch (e) {
    console.error('Auth callback error:', e.message);
    res.redirect(`${FRONTEND_URL}/?authError=${encodeURIComponent(e.message)}`);
  }
});

module.exports = router;
