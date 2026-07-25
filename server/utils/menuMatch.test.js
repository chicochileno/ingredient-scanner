const { test } = require('node:test');
const assert = require('node:assert');
const { allergenUnion, parseMenuReport, mapMenuToProfiles } = require('./menuMatch');

test('allergenUnion dedupes and sorts allergen names across profiles', () => {
  const profiles = [
    { allergenNames: ['Peanut', 'Sesame'] },
    { allergenNames: ['sesame', 'Egg'] },
    { allergenNames: [] },
  ];
  // case-insensitive dedupe, keeps first-seen casing, sorted case-insensitively
  assert.deepStrictEqual(allergenUnion(profiles), ['Egg', 'Peanut', 'Sesame']);
});

test('allergenUnion handles missing allergenNames', () => {
  assert.deepStrictEqual(allergenUnion([{}, { allergenNames: ['Soy'] }]), ['Soy']);
});

test('parseMenuReport keeps valid dishes and filters unknown categories', () => {
  const validKeys = ['dairy', 'gluten'];
  const input = {
    dishes: [
      { name: 'Chicken Alfredo', categories: ['dairy', 'unknown-cat'], allergens: ['Peanut'], note: 'creamy sauce' },
      { name: 'Side Salad', categories: [], allergens: [], note: '' },
    ],
  };
  const out = parseMenuReport(input, validKeys);
  assert.deepStrictEqual(out, [
    { name: 'Chicken Alfredo', categories: ['dairy'], allergens: ['Peanut'], note: 'creamy sauce' },
    { name: 'Side Salad', categories: [], allergens: [], note: '' },
  ]);
});

test('parseMenuReport drops malformed dishes and coerces missing fields', () => {
  const out = parseMenuReport(
    { dishes: [{ name: 'OK', categories: ['gluten'] }, { note: 'no name' }, 'garbage'] },
    ['gluten']
  );
  assert.deepStrictEqual(out, [{ name: 'OK', categories: ['gluten'], allergens: [], note: '' }]);
});

test('parseMenuReport returns [] for missing/empty dishes', () => {
  assert.deepStrictEqual(parseMenuReport({}, ['dairy']), []);
  assert.deepStrictEqual(parseMenuReport({ dishes: [] }, ['dairy']), []);
  assert.deepStrictEqual(parseMenuReport(null, ['dairy']), []);
});

test('mapMenuToProfiles flags by category and by allergen name', () => {
  const dishes = [
    { name: 'Chicken Alfredo', categories: ['dairy'], allergens: [], note: 'creamy' },
    { name: 'Pad Thai', categories: ['gluten'], allergens: ['Peanut'], note: 'has peanuts' },
    { name: 'Green Salad', categories: [], allergens: [], note: '' },
  ];
  const profiles = [
    { profileId: 'p1', name: 'Emma', activeCategories: ['dairy'], allergenNames: [] },
    { profileId: 'p2', name: 'Liam', activeCategories: ['dyes'], allergenNames: ['peanut'] },
  ];
  const labels = { dairy: 'Dairy / Casein', gluten: 'Gluten' };
  const result = mapMenuToProfiles(dishes, profiles, labels);

  assert.deepStrictEqual(result.dishes[0].perProfile, [
    { profileId: 'p1', name: 'Emma', flagged: true },
    { profileId: 'p2', name: 'Liam', flagged: false },
  ]);
  assert.deepStrictEqual(result.dishes[0].categoryLabels, ['Dairy / Casein']);
  // Pad Thai: p1 not flagged (gluten not active), p2 flagged via peanut allergen (case-insensitive)
  assert.deepStrictEqual(result.dishes[1].perProfile, [
    { profileId: 'p1', name: 'Emma', flagged: false },
    { profileId: 'p2', name: 'Liam', flagged: true },
  ]);
  assert.deepStrictEqual(result.profiles, [
    { profileId: 'p1', name: 'Emma', flaggedCount: 1 },
    { profileId: 'p2', name: 'Liam', flaggedCount: 1 },
  ]);
});
