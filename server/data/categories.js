// Canonical category keys used by the matcher, presets, and profile editor.
const CATEGORIES = [
  { key: 'dyes', label: 'Artificial Dyes' },
  { key: 'preservatives', label: 'Preservatives' },
  { key: 'excitotoxins', label: 'MSG & Excitotoxins' },
  { key: 'sweeteners', label: 'Artificial Sweeteners' },
  { key: 'hfcs', label: 'Added Sugars / HFCS' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'dairy', label: 'Dairy / Casein' },
  { key: 'soy', label: 'Soy' },
  { key: 'artificial-flavors', label: 'Artificial Flavors' },
  { key: 'carrageenan', label: 'Carrageenan' },
  { key: 'aluminum', label: 'Aluminum Additives' },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
module.exports = { CATEGORIES, CATEGORY_KEYS };
