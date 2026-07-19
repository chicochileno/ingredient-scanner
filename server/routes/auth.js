const crypto = require('crypto');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const admin = require('../utils/firebaseAdmin');

const router = express.Router();

const CALLBACK_URL = process.env.CALLBACK_URL || 'https://precious-acceptance-production.up.railway.app/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scanner.joelrog.com';
const STATE_COOKIE = 'oauth_state';

function getOAuthClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL
  );
}

// Read a single cookie value without adding a cookie-parser dependency.
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

// Constant-time string compare (guards against length/timing leaks).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// GET /auth/google — redirect to Google sign-in.
// Sets an unguessable `state` in an httpOnly, SameSite=Lax cookie AND passes it to
// Google; the callback requires them to match — this prevents login CSRF.
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(24).toString('base64url');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.secure, // true in prod (HTTPS via trust proxy); false on http://localhost dev
    sameSite: 'lax', // survives the top-level redirect back from Google
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/auth',
  });
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

// GET /auth/google/callback — verify state, exchange code, mint a Firebase custom token,
// redirect to the app with the token in the URL FRAGMENT (never sent to servers/logs/Referer).
router.get('/google/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const cookieState = readCookie(req, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, { path: '/auth' });

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL}/?authError=cancelled`);
  }
  // CSRF check: the returned state must match the one we set in the cookie.
  if (!state || !cookieState || !safeEqual(String(state), cookieState)) {
    return res.redirect(`${FRONTEND_URL}/?authError=invalid_state`);
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

    // Find existing Firebase user for this Google account so that Safari (popup)
    // and Chrome iOS (server OAuth) share the same UID and see the same history.
    let uid;
    try {
      const userRecord = await admin.auth().getUserByProviderUid('google.com', payload.sub);
      uid = userRecord.uid;
    } catch (e) {
      // No existing user — import one with Google provider linked so future
      // signInWithPopup calls on other browsers resolve to the same UID.
      uid = `google_${payload.sub}`;
      await admin.auth().importUsers([{
        uid,
        email: payload.email,
        displayName: payload.name,
        photoURL: payload.picture,
        providerData: [{
          uid: payload.sub,
          email: payload.email,
          displayName: payload.name,
          photoURL: payload.picture,
          providerId: 'google.com',
        }],
      }]);
    }

    const customToken = await admin.auth().createCustomToken(uid);
    // Token in the fragment (#), not the query — fragments are never sent to the
    // server, proxy/CDN logs, or the Referer header.
    res.redirect(`${FRONTEND_URL}/#firebaseToken=${encodeURIComponent(customToken)}`);
  } catch (e) {
    console.error('Auth callback error:', e.message);
    res.redirect(`${FRONTEND_URL}/?authError=signin_failed`);
  }
});

module.exports = router;
