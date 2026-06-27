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
