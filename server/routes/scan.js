const express = require('express');
const axios = require('axios');
const { matchAllProfiles, addDismissedFlag, rematchBatch, getProfilesWithAllergens } = require('../utils/userMatchData');
const requireAuth = require('../middleware/requireAuth');
const { getBilling, tryConsumeScan } = require('../utils/billing');
const { CATEGORIES } = require('../data/categories');
const { analyzeMenu } = require('../utils/menuAnalyzer');
const { allergenUnion, parseMenuReport, mapMenuToProfiles } = require('../utils/menuMatch');

const router = express.Router();

const MENU_TEXT_CAP = 6000;
const CATEGORY_KEYS_SET = CATEGORIES.map((c) => c.key);
const CATEGORY_LABEL_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

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
        return res.json({ productName, imageUrl, upc, rawText: '', profiles: [], flagged: [], ingredientCount: 0 });
      }
      const profiles = await matchAllProfiles(req.uid, rawIngredients);
      const consumed = await tryConsumeScan(req.uid);
      if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, profiles, flagged: profiles[0]?.flagged || [] });
    }

    if (!annotations || !annotations.fullTextAnnotation) {
      return res.json({ rawText: '', profiles: [], flagged: [], ingredientCount: 0 });
    }

    const rawText = annotations.fullTextAnnotation.text;
    const ingredientsText = extractIngredientsSection(rawText);
    const profiles = await matchAllProfiles(req.uid, ingredientsText);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ rawText, profiles, flagged: profiles[0]?.flagged || [] });
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
  const profiles = await matchAllProfiles(req.uid, text);
  res.json({ rawText: text, profiles, flagged: profiles[0]?.flagged || [] });
});

// Scan a restaurant menu (photo -> Vision OCR, or pasted text) and map likely
// concerns to every profile via Claude. Consumes a scan on success.
router.post('/menu', requireAuth, async (req, res) => {
  const { imageBase64, text } = req.body;
  if (!imageBase64 && typeof text !== 'string') {
    return res.status(400).json({ error: 'imageBase64 or text required' });
  }

  const allowed = await checkScanLimit(req.uid);
  if (!allowed) return res.status(403).json({ error: 'scan_limit_reached' });

  try {
    // 1. Resolve menu text (OCR the photo, or use pasted text).
    let menuText = typeof text === 'string' ? text : '';
    if (imageBase64) {
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Vision API key not configured' });
      const visionRes = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        { requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 1 }] }] }
      );
      menuText = visionRes.data.responses[0]?.fullTextAnnotation?.text || '';
    }

    menuText = menuText.trim();
    if (!menuText) return res.status(422).json({ error: 'No menu text found. Try a clearer photo or paste the menu text.' });
    if (menuText.length > MENU_TEXT_CAP) menuText = menuText.slice(0, MENU_TEXT_CAP);

    // 2. Build the concern set: all canonical categories + union of allergen names.
    const profiles = await getProfilesWithAllergens(req.uid);
    const allergenNames = allergenUnion(profiles);

    // 3. Ask Claude, then sanitize its output.
    const rawDishes = await analyzeMenu(menuText, { categories: CATEGORIES, allergenNames });
    const dishes = parseMenuReport({ dishes: rawDishes }, CATEGORY_KEYS_SET);

    // 4. Map to profiles.
    const mapped = mapMenuToProfiles(
      dishes,
      profiles.map((p) => ({ profileId: p.id, name: p.name, activeCategories: p.activeCategories, allergenNames: p.allergenNames })),
      CATEGORY_LABEL_BY_KEY
    );

    // 5. Consume a scan only after a successful analysis.
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });

    return res.json({
      type: 'menu',
      menuText,
      dishes: mapped.dishes,
      profiles: mapped.profiles,
      noDishes: dishes.length === 0,
    });
  } catch (err) {
    console.error('Menu scan error:', err?.response?.data || err.message);
    return res.status(502).json({ error: 'Failed to analyze menu. Please try again.' });
  }
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
      return res.json({ productName, imageUrl, rawText: '', profiles: [], flagged: [], ingredientCount: 0 });
    }
    const profiles = await matchAllProfiles(req.uid, rawIngredients);
    const consumed = await tryConsumeScan(req.uid);
    if (!consumed) return res.status(403).json({ error: 'scan_limit_reached' });
    res.json({ productName, imageUrl, rawText: rawIngredients, profiles, flagged: profiles[0]?.flagged || [] });
  } catch (err) {
    console.error('Open Food Facts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product data' });
  }
});

router.post('/dismiss', requireAuth, async (req, res) => {
  const { profileId, ingredientId } = req.body;
  const idOk = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  if (!idOk(profileId)) return res.status(400).json({ error: 'Invalid profileId' });
  if (!idOk(ingredientId)) return res.status(400).json({ error: 'Invalid ingredientId' });
  try {
    await addDismissedFlag(req.uid, profileId, ingredientId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Dismiss error:', err.message);
    res.status(500).json({ error: 'Failed to dismiss flag' });
  }
});

// Re-run matching on already-stored text (e.g. history views). Does NOT consume a scan.
router.post('/rematch', requireAuth, async (req, res) => {
  const { rawText } = req.body;
  if (typeof rawText !== 'string') {
    return res.status(400).json({ error: 'rawText required' });
  }
  if (rawText.length > 20000) {
    return res.status(400).json({ error: 'rawText too long' });
  }
  try {
    const profiles = await matchAllProfiles(req.uid, rawText.trim() ? rawText : '');
    res.json({ profiles, flagged: profiles[0]?.flagged || [] });
  } catch (err) {
    console.error('Rematch error:', err.message);
    res.status(500).json({ error: 'Failed to rematch' });
  }
});

// Batch re-match: match many saved-item texts against all profiles in one call.
// Does NOT consume a scan.
router.post('/rematch-batch', requireAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' });
  }
  if (items.length > 200) {
    return res.status(400).json({ error: 'too many items' });
  }
  const clean = [];
  for (const it of items) {
    if (!it || typeof it.itemId !== 'string' || typeof it.rawText !== 'string') {
      return res.status(400).json({ error: 'each item needs itemId and rawText strings' });
    }
    clean.push({ itemId: it.itemId, rawText: it.rawText.slice(0, 20000) });
  }
  try {
    const results = await rematchBatch(req.uid, clean);
    res.json({ results });
  } catch (err) {
    console.error('Rematch-batch error:', err.message);
    res.status(500).json({ error: 'Failed to rematch batch' });
  }
});

module.exports = router;
