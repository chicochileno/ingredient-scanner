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
