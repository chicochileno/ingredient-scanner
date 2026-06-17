const express = require('express');
const axios = require('axios');
const { matchIngredients } = require('../utils/ingredientMatcher');

const router = express.Router();

// Extract just the ingredients section from raw OCR text to avoid false matches
// in nutrition facts, serving suggestions, or callouts like "great with milk"
function extractIngredientsSection(text) {
  const match = text.match(/ingredients?\s*:?\s*/i);
  if (!match) return text;

  const start = match.index + match[0].length;
  const remainder = text.slice(start);

  // Stop at common post-ingredients sections
  const endMatch = remainder.search(
    /\b(contains\s*:|manufactured\s+(in|by)|distributed\s+by|produced\s+by|packed\s+by|calories|serving\s+size|amount\s+per|nutrition\s+facts|percent\s+daily)\b/i
  );

  const extracted = endMatch !== -1 ? remainder.slice(0, endMatch) : remainder;
  return extracted.trim() || text;
}

// Extract the most likely UPC/EAN barcode from OCR text
function extractBarcode(text) {
  // Match standalone 8-14 digit sequences (UPC-E=8, UPC-A=12, EAN-13=13, EAN-14=14)
  const matches = text.match(/\b\d{8,14}\b/g);
  if (!matches) return null;
  // Prefer 12 or 13 digit codes (most common retail barcodes)
  const preferred = matches.find((m) => m.length === 12 || m.length === 13);
  return preferred || matches[0];
}

// POST /scan/image — accepts base64 image, runs Google Vision OCR, returns flagged ingredients
router.post('/image', async (req, res) => {
  const { imageBase64, detectBarcode } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Vision API key not configured' });

  try {
    const visionRes = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
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
        return res.json({ productName, imageUrl, upc, rawText: '', flagged: [], ingredientCount: 0 });
      }

      const flagged = matchIngredients(rawIngredients);
      return res.json({ productName, imageUrl, upc, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
    }

    if (!annotations || !annotations.fullTextAnnotation) {
      return res.json({ rawText: '', flagged: [], ingredientCount: 0 });
    }

    const rawText = annotations.fullTextAnnotation.text;
    const ingredientsText = extractIngredientsSection(rawText);
    const flagged = matchIngredients(ingredientsText);

    res.json({ rawText, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Vision API error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// POST /scan/text — accepts raw text (e.g. from barcode → Open Food Facts lookup)
router.post('/text', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const flagged = matchIngredients(text);
  res.json({ rawText: text, flagged, ingredientCount: flagged.length });
});

// GET /scan/barcode/:upc — looks up product on Open Food Facts, returns flagged ingredients
router.get('/barcode/:upc', async (req, res) => {
  const { upc } = req.params;

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
      return res.json({ productName, imageUrl, rawText: '', flagged: [], ingredientCount: 0 });
    }

    const flagged = matchIngredients(rawIngredients);
    res.json({ productName, imageUrl, rawText: rawIngredients, flagged, ingredientCount: flagged.length });
  } catch (err) {
    console.error('Open Food Facts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product data' });
  }
});

module.exports = router;
