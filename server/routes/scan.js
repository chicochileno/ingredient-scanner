const express = require('express');
const axios = require('axios');
const { matchIngredients } = require('../utils/ingredientMatcher');
const { getMatchOptions, addDismissedFlag } = require('../utils/userMatchData');
const requireAuth = require('../middleware/requireAuth');
const { getBilling, tryConsumeScan } = require('../utils/billing');

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
        const consumed = await tryConsumeScan(req.uid);
        if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
        return res.json({ productName, imageUrl, upc, rawText: '', flagged: [], ingredientCount: 0 });
      }
      const matchOptions = await getMatchOptions(req.uid);
      const flagged = matchIngredients(rawIngredients, matchOptions);
      const consumed = await tryConsumeScan(req.uid);
      if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
    }

    if (!annotations || !annotations.fullTextAnnotation) {
      return res.json({ rawText: '', flagged: [], ingredientCount: 0 });
    }

    const rawText = annotations.fullTextAnnotation.text;
    const ingredientsText = extractIngredientsSection(rawText);
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(ingredientsText, matchOptions);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ rawText, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Vision API error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.post('/text', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const allowed = await tryConsumeScan(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });
  const matchOptions = await getMatchOptions(req.uid);
  const flagged = matchIngredients(text, matchOptions);
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
      const consumed = await tryConsumeScan(req.uid);
      if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
      return res.json({ productName, imageUrl, rawText: '', flagged: [], ingredientCount: 0 });
    }
    const matchOptions = await getMatchOptions(req.uid);
    const flagged = matchIngredients(rawIngredients, matchOptions);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ productName, imageUrl, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Open Food Facts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product data' });
  }
});

router.post('/dismiss', requireAuth, async (req, res) => {
  const { ingredientId } = req.body;
  if (!ingredientId || typeof ingredientId !== 'string') {
    return res.status(400).json({ error: 'ingredientId required' });
  }
  try {
    await addDismissedFlag(req.uid, ingredientId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Dismiss error:', err.message);
    res.status(500).json({ error: 'Failed to dismiss flag' });
  }
});

module.exports = router;
