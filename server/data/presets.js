const { CATEGORY_KEYS } = require('./categories');

const PRESETS = [
  { key: 'autism', label: 'Autism / ASD', description: 'Broad — flags every curated category.', categories: [...CATEGORY_KEYS] },
  { key: 'feingold', label: 'Feingold', description: 'Artificial dyes, artificial flavors, and petroleum preservatives.', categories: ['dyes', 'artificial-flavors', 'preservatives'] },
  { key: 'gfcf', label: 'GFCF', description: 'Gluten-free, casein-free.', categories: ['gluten', 'dairy'] },
  { key: 'dairy-free', label: 'Dairy-Free', description: 'Casein and dairy proteins.', categories: ['dairy'] },
  { key: 'no-dyes', label: 'No Artificial Dyes', description: 'Synthetic color additives.', categories: ['dyes'] },
];

module.exports = { PRESETS };
