// Splits "Water, Sugar (cane), Onion, Salt" into ["Water", "Sugar (cane)", "Onion", "Salt"]
// Respects nested parentheses so "Natural Flavor (Onion, Garlic)" is one entry.
function parseIngredients(text) {
  const results = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const t = current.trim();
      if (t) results.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const t = current.trim();
  if (t) results.push(t);
  return results;
}

// Returns flagged items in the same shape as the server response.
// Exact match only: allergen "onion" matches ingredient "onion" but not "onion powder".
export function matchAllergens(rawText, allergens) {
  if (!rawText || !allergens || allergens.length === 0) return [];
  const ingredients = parseIngredients(rawText);
  const normalized = ingredients.map(s => s.toLowerCase());
  const flagged = [];
  const seen = new Set();
  for (const allergen of allergens) {
    if (seen.has(allergen.id)) continue;
    if (!allergen.name) continue;
    const target = allergen.name.toLowerCase().trim();
    const idx = normalized.findIndex(n => n === target);
    if (idx !== -1) {
      seen.add(allergen.id);
      flagged.push({
        id: allergen.id,
        flag: allergen.name,
        severity: allergen.type === 'allergy' ? 'high' : 'moderate',
        explanation: 'Listed in your personal allergens.',
        matchedOn: ingredients[idx],
      });
    }
  }
  return flagged;
}
