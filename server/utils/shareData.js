const { matchIngredients } = require('./ingredientMatcher');
const { CATEGORIES } = require('../data/categories');

const LABEL_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

function isValidShareId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id);
}

// profile: { name, activeCategories }, allergens: [{ name }]
function buildProfileShare(profile, allergens) {
  const categoryLabels = (profile.activeCategories || [])
    .map((k) => LABEL_BY_KEY[k])
    .filter(Boolean);
  const allergenNames = (allergens || []).map((a) => a.name).filter(Boolean);
  return {
    type: 'profile',
    title: profile.name || 'Food profile',
    avoid: [...categoryLabels, ...allergenNames],
  };
}

// items: [{ kind, name, rawText }], profileInputs: { activeCategories, personalAllergens, dismissedIds }
function buildListShare(listName, childName, items, profileInputs) {
  const out = (items || []).map((it) => {
    if (it.kind !== 'scanned') return { name: it.name, status: 'unscanned' };
    const flagged = matchIngredients(it.rawText || '', {
      activeCategories: profileInputs.activeCategories || [],
      personalAllergens: profileInputs.personalAllergens || [],
      dismissedIds: profileInputs.dismissedIds || new Set(),
    });
    return { name: it.name, status: flagged.length > 0 ? 'flagged' : 'safe' };
  });
  return { type: 'list', title: listName || 'List', childName: childName || null, items: out };
}

module.exports = { buildProfileShare, buildListShare, isValidShareId };
