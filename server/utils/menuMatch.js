// Pure menu-matching logic. No IO — safe to unit test directly.

// Union of custom allergen names across all profiles, case-insensitively
// deduped (first-seen casing wins), sorted case-insensitively.
function allergenUnion(profiles) {
  const seen = new Map(); // lowerName -> originalName
  for (const p of profiles || []) {
    for (const name of p.allergenNames || []) {
      const key = String(name).toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Validate/sanitize Claude's tool output into a clean dishes array.
// Drops non-objects and dishes without a string name; filters categories to
// the known canonical keys; coerces allergens/note to safe defaults.
function parseMenuReport(toolInput, validCategoryKeys) {
  const valid = new Set(validCategoryKeys || []);
  const dishes = toolInput && Array.isArray(toolInput.dishes) ? toolInput.dishes : [];
  const out = [];
  for (const d of dishes) {
    if (!d || typeof d !== 'object' || typeof d.name !== 'string' || !d.name.trim()) continue;
    const categories = Array.isArray(d.categories)
      ? d.categories.filter((c) => valid.has(c))
      : [];
    const allergens = Array.isArray(d.allergens)
      ? d.allergens.filter((a) => typeof a === 'string' && a.trim())
      : [];
    const note = typeof d.note === 'string' ? d.note : '';
    out.push({ name: d.name, categories, allergens, note });
  }
  return out;
}

// Map parsed dishes to every profile. A dish is flagged for a profile if any of
// its categories are in that profile's activeCategories, OR any of its allergens
// matches one of that profile's allergen names (case-insensitive).
// profiles: [{ profileId, name, activeCategories:[key], allergenNames:[str] }]
// Returns { dishes:[{name,note,categories,categoryLabels,allergens,perProfile:[{profileId,name,flagged}]}],
//           profiles:[{profileId,name,flaggedCount}] }
function mapMenuToProfiles(dishes, profiles, categoryLabelByKey) {
  const labelMap = categoryLabelByKey || {};
  const counts = new Map(profiles.map((p) => [p.profileId, 0]));

  const mappedDishes = dishes.map((dish) => {
    const dishAllergensLower = dish.allergens.map((a) => a.toLowerCase());
    const perProfile = profiles.map((p) => {
      const active = p.activeCategories || [];
      const allergenNamesLower = (p.allergenNames || []).map((a) => a.toLowerCase());
      const catMatch = dish.categories.some((c) => active.includes(c));
      const allergenMatch = dishAllergensLower.some((a) => allergenNamesLower.includes(a));
      const flagged = catMatch || allergenMatch;
      if (flagged) counts.set(p.profileId, counts.get(p.profileId) + 1);
      return { profileId: p.profileId, name: p.name != null ? p.name : null, flagged };
    });
    return {
      name: dish.name,
      note: dish.note,
      categories: dish.categories,
      categoryLabels: dish.categories.map((c) => labelMap[c] || c),
      allergens: dish.allergens,
      perProfile,
    };
  });

  return {
    dishes: mappedDishes,
    profiles: profiles.map((p) => ({
      profileId: p.profileId,
      name: p.name != null ? p.name : null,
      flaggedCount: counts.get(p.profileId),
    })),
  };
}

module.exports = { allergenUnion, parseMenuReport, mapMenuToProfiles };
