const ingredients = require('../data/inflammatoryIngredients');

// Normalize: lowercase, strip punctuation (keep & and digits), collapse whitespace
function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip "may contain", allergen warnings, and X-free descriptor phrases
function stripNonIngredients(text) {
  return text
    .replace(/may contain[^.]*\.?/gi, '')
    .replace(/contains?:?\s*(traces?\s+of\s*)?[^.]*\.?/gi, '')
    .replace(/allergen\s+information[^.]*\.?/gi, '')
    .replace(/manufactured\s+in[^.]*\.?/gi, '')
    .replace(/processed\s+in[^.]*\.?/gi, '')
    .replace(/made\s+in\s+a\s+facility[^.]*\.?/gi, '')
    .replace(/produced\s+in[^.]*\.?/gi, '')
    .replace(/\b(gluten|dairy|casein|wheat|soy|nut|egg|peanut)[\s-]free\b/gi, '');
}

function parseIngredientList(rawText) {
  const cleaned = stripNonIngredients(rawText);
  return cleaned
    .split(/[,;()\[\]{}]+/)
    .map((s) => normalize(s))
    .filter((s) => s.length > 1);
}

// True if `name` appears as a whole word/phrase inside the already-normalized `token`
function tokenContainsPhrase(token, name) {
  if (!name) return false;
  const re = new RegExp(`(^|\\s)${escapeRegex(name)}(\\s|$)`);
  return re.test(token);
}

// Evaluate one entry ({ names, negators?, ambiguousNames? }) against tokens.
// Returns { matchedOn, tier } or null.
function evaluateEntry(entry, tokens) {
  const names = entry.names || [];
  const negators = (entry.negators || []).map(normalize).filter(Boolean);
  const ambiguous = new Set((entry.ambiguousNames || []).map(normalize));
  for (const rawName of names) {
    const name = normalize(rawName);
    if (!name) continue;
    for (const token of tokens) {
      if (!tokenContainsPhrase(token, name)) continue;
      const suppressed = negators.some((neg) => tokenContainsPhrase(token, neg));
      if (suppressed) continue;
      const tier = ambiguous.has(name) ? 'possible' : 'confident';
      return { matchedOn: token, tier };
    }
  }
  return null;
}

function matchIngredients(rawText, options = {}) {
  const personalAllergens = options.personalAllergens || [];
  const dismissedIds =
    options.dismissedIds instanceof Set
      ? options.dismissedIds
      : new Set(options.dismissedIds || []);

  const tokens = parseIngredientList(rawText || '');
  const flagged = [];
  const seen = new Set();

  // Curated inflammatory ingredients
  for (const entry of ingredients) {
    if (seen.has(entry.id)) continue;
    const res = evaluateEntry(entry, tokens);
    if (!res) continue;
    seen.add(entry.id);
    flagged.push({
      id: entry.id,
      flag: entry.flag,
      category: entry.category,
      severity: entry.severity,
      tier: res.tier,
      source: 'curated',
      explanation: entry.explanation,
      // matchedOn is the full normalized label token (e.g. "enriched wheat flour"), not the bare synonym
      matchedOn: res.matchedOn,
      ...(entry.citations ? { citations: entry.citations } : {}),
    });
  }

  // Personal allergens (each name is a one-item synonym list; no negators/ambiguous)
  for (const allergen of personalAllergens) {
    if (!allergen || !allergen.name || seen.has(allergen.id)) continue;
    const res = evaluateEntry({ names: [allergen.name] }, tokens);
    if (!res) continue;
    seen.add(allergen.id);
    const name = String(allergen.name);
    flagged.push({
      id: allergen.id,
      flag: name.charAt(0).toUpperCase() + name.slice(1),
      category: null,
      severity: allergen.type === 'allergy' ? 'high' : 'moderate',
      tier: 'confident',
      source: 'personal',
      explanation: 'Listed in your personal allergens.',
      matchedOn: res.matchedOn,
    });
  }

  // Override filter, then sort: confident-high, confident-moderate, possible last
  const rank = (f) => (f.tier === 'possible' ? 2 : f.severity === 'high' ? 0 : 1);
  return flagged.filter((f) => !dismissedIds.has(f.id)).sort((a, b) => rank(a) - rank(b));
}

module.exports = { matchIngredients, parseIngredientList };
