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
