export const CATEGORIES = [
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

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export const PRESETS = [
  { key: 'autism', label: 'Autism / ASD', description: 'Broad — flags every curated category.', categories: [...CATEGORY_KEYS] },
  { key: 'feingold', label: 'Feingold', description: 'Artificial dyes, artificial flavors, and petroleum preservatives.', categories: ['dyes', 'artificial-flavors', 'preservatives'] },
  { key: 'gfcf', label: 'GFCF', description: 'Gluten-free, casein-free.', categories: ['gluten', 'dairy'] },
  { key: 'dairy-free', label: 'Dairy-Free', description: 'Casein and dairy proteins.', categories: ['dairy'] },
  { key: 'no-dyes', label: 'No Artificial Dyes', description: 'Synthetic color additives.', categories: ['dyes'] },
];
