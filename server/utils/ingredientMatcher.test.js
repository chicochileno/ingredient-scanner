const test = require('node:test');
const assert = require('node:assert');
const { matchIngredients } = require('./ingredientMatcher');

test('matches a curated synonym variant at word boundaries', () => {
  const flags = matchIngredients('Sugar, FD&C Red No. 40, Salt');
  const red = flags.find((f) => f.id === 'red40');
  assert.ok(red, 'expected red40 to be flagged');
  assert.strictEqual(red.tier, 'confident');
  assert.strictEqual(red.source, 'curated');
  assert.strictEqual(red.severity, 'high');
});

test('does NOT match a synonym that only appears mid-word', () => {
  const flags = matchIngredients('Maltodextrin, Salt');
  assert.strictEqual(flags.find((f) => f.id === 'gluten'), undefined);
});

test('matches a whole word even with extra words around it', () => {
  const flags = matchIngredients('Wheat Flour, Water');
  assert.ok(flags.find((f) => f.id === 'gluten'));
});

test('returns empty array for empty input', () => {
  assert.deepStrictEqual(matchIngredients(''), []);
});

test('negator suppresses a false-positive dairy match', () => {
  const flags = matchIngredients('Water, Coconut Milk, Sugar');
  assert.strictEqual(flags.find((f) => f.id === 'casein'), undefined);
});

test('negator does not suppress a real dairy match', () => {
  const flags = matchIngredients('Water, Goat Milk, Sugar');
  assert.ok(flags.find((f) => f.id === 'casein'), 'goat milk should still flag dairy');
});

test('ambiguous synonym resolves to the soft "possible" tier', () => {
  const flags = matchIngredients('Sugar, Soy Lecithin, Salt');
  const soy = flags.find((f) => f.id === 'soy');
  assert.ok(soy, 'expected soy to be flagged');
  assert.strictEqual(soy.tier, 'possible');
});

test('non-ambiguous synonym for the same entry stays confident', () => {
  const flags = matchIngredients('Soybean Oil, Salt');
  const soy = flags.find((f) => f.id === 'soy');
  assert.ok(soy);
  assert.strictEqual(soy.tier, 'confident');
});

test('citations flow through to flagged output when present', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt');
  const red = flags.find((f) => f.id === 'red40');
  assert.ok(Array.isArray(red.citations) && red.citations.length > 0, 'red40 should carry citations');
  assert.ok(red.citations[0].title, 'citation needs a title');
});

test('personal allergen matches variants at word boundaries', () => {
  const personalAllergens = [{ id: 'a1', name: 'onion', type: 'allergy' }];
  const flags = matchIngredients('Water, Onion Powder, Salt', { personalAllergens });
  const onion = flags.find((f) => f.id === 'a1');
  assert.ok(onion, 'expected personal allergen to match "onion powder"');
  assert.strictEqual(onion.source, 'personal');
  assert.strictEqual(onion.severity, 'high'); // type 'allergy' -> high
  assert.strictEqual(onion.tier, 'confident');
});

test('sensitivity-type personal allergen maps to moderate', () => {
  const personalAllergens = [{ id: 'a2', name: 'garlic', type: 'sensitivity' }];
  const flags = matchIngredients('Roasted Garlic, Salt', { personalAllergens });
  const garlic = flags.find((f) => f.id === 'a2');
  assert.ok(garlic);
  assert.strictEqual(garlic.severity, 'moderate');
});

test('dismissed ids are filtered out', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { dismissedIds: new Set(['red40']) });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('dismissedIds also accepts a plain array', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { dismissedIds: ['red40'] });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('possible-tier flags sort after confident flags', () => {
  const flags = matchIngredients('Red 40, Soy Lecithin');
  const redIdx = flags.findIndex((f) => f.id === 'red40');
  const soyIdx = flags.findIndex((f) => f.id === 'soy');
  assert.ok(redIdx < soyIdx, 'confident flag should come before possible flag');
});

test('activeCategories: inactive category is NOT flagged', () => {
  const flags = matchIngredients('Sugar, Red 40, Salt', { activeCategories: ['dairy'] });
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined);
});

test('activeCategories: active category IS flagged', () => {
  const flags = matchIngredients('Water, Milk, Sugar', { activeCategories: ['dairy'] });
  assert.ok(flags.find((f) => f.id === 'casein'));
});

test('activeCategories: personal allergens flag regardless of categories', () => {
  const personalAllergens = [{ id: 'a1', name: 'onion', type: 'allergy' }];
  const flags = matchIngredients('Onion, Red 40', { activeCategories: ['dairy'], personalAllergens });
  assert.ok(flags.find((f) => f.id === 'a1'), 'personal allergen should still match');
  assert.strictEqual(flags.find((f) => f.id === 'red40'), undefined, 'dye not active');
});

test('activeCategories: empty array flags no curated ingredients', () => {
  const flags = matchIngredients('Red 40, Milk, Wheat', { activeCategories: [] });
  assert.strictEqual(flags.length, 0);
});

test('activeCategories: omitted falls back to all curated (System 1 behavior)', () => {
  const flags = matchIngredients('Red 40, Milk');
  assert.ok(flags.find((f) => f.id === 'red40'));
  assert.ok(flags.find((f) => f.id === 'casein'));
});
