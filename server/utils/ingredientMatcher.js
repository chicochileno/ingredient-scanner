const ingredients = require('../data/inflammatoryIngredients');

// Normalize text for matching: lowercase, strip punctuation, collapse whitespace
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parse a raw ingredient string into individual tokens
function parseIngredientList(rawText) {
  return rawText
    .split(/[,;()\[\]{}]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 1);
}

function matchIngredients(rawIngredientText) {
  const tokens = parseIngredientList(rawIngredientText);
  const flagged = [];
  const seen = new Set();

  for (const ingredient of ingredients) {
    for (const name of ingredient.names) {
      const normalizedName = normalize(name);
      const matched = tokens.some((token) => token.includes(normalizedName));
      if (matched && !seen.has(ingredient.id)) {
        seen.add(ingredient.id);
        flagged.push({
          id: ingredient.id,
          flag: ingredient.flag,
          category: ingredient.category,
          severity: ingredient.severity,
          explanation: ingredient.explanation,
          matchedOn: name,
        });
        break;
      }
    }
  }

  // Sort: high severity first
  flagged.sort((a, b) => (a.severity === 'high' && b.severity !== 'high' ? -1 : 1));

  return flagged;
}

module.exports = { matchIngredients, parseIngredientList };
