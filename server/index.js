require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scanRoutes = require('./routes/scan');
const authRoutes = require('./routes/auth');
const { router: stripeRouter, webhookHandler } = require('./routes/stripe');
const { createRateLimiter } = require('./middleware/rateLimit');
const shareRoutes = require('./routes/share');
const supportRoutes = require('./routes/support');

const app = express();
// Behind Railway's reverse proxy: trust the first proxy hop so req.ip is the real
// client IP (needed for the per-IP rate limiter on the public /share endpoint).
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'https://ingredientscan.app',
  'https://scanner.joelrog.com',
  'http://localhost:5173',
  'capacitor://localhost', // native iOS app (Capacitor)
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

// Per-IP rate limits on the auth + Stripe endpoints (the Stripe webhook is mounted
// separately above, before express.json(), so it is NOT rate-limited).
const authLimiter = createRateLimiter({ max: 30, windowMs: 60000 });
const stripeLimiter = createRateLimiter({ max: 20, windowMs: 60000 });
const supportLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

app.use('/scan', scanRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/stripe', stripeLimiter, stripeRouter);
app.use('/share', shareRoutes);
app.use('/support', supportLimiter, supportRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', version: '3.0', routes: ['scan', 'auth', 'stripe', 'share'] }));

app.listen(PORT, () => {
  console.log(`Server v3.0 running on port ${PORT}`);
});
