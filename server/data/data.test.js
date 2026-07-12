const test = require('node:test');
const assert = require('node:assert');
const { CATEGORIES, CATEGORY_KEYS } = require('./categories');

test('categories: keys are unique and non-empty', () => {
  assert.ok(CATEGORIES.length >= 11);
  const keys = CATEGORIES.map((c) => c.key);
  assert.strictEqual(new Set(keys).size, keys.length, 'keys must be unique');
  for (const c of CATEGORIES) {
    assert.match(c.key, /^[a-z-]+$/, `key "${c.key}" must be kebab-case`);
    assert.ok(c.label && c.label.length > 0, 'label required');
  }
});

test('categories: CATEGORY_KEYS mirrors CATEGORIES keys', () => {
  assert.deepStrictEqual(CATEGORY_KEYS, CATEGORIES.map((c) => c.key));
});

const ingredients = require('./inflammatoryIngredients');
const { CATEGORY_KEYS: KEYS } = require('./categories');

test('every ingredient has a valid categoryKey', () => {
  for (const ing of ingredients) {
    assert.ok(ing.categoryKey, `ingredient "${ing.id}" missing categoryKey`);
    assert.ok(KEYS.includes(ing.categoryKey), `ingredient "${ing.id}" has unknown categoryKey "${ing.categoryKey}"`);
  }
});

test('a categoryKey exists for each of the expected mappings', () => {
  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i.categoryKey]));
  assert.strictEqual(byId.red40, 'dyes');
  assert.strictEqual(byId.bht, 'preservatives');
  assert.strictEqual(byId.msg, 'excitotoxins');
  assert.strictEqual(byId.sucralose, 'sweeteners');
  assert.strictEqual(byId.hfcs, 'hfcs');
  assert.strictEqual(byId.gluten, 'gluten');
  assert.strictEqual(byId.casein, 'dairy');
  assert.strictEqual(byId.soy, 'soy');
  assert.strictEqual(byId.artificialflavors, 'artificial-flavors');
  assert.strictEqual(byId.carrageenan, 'carrageenan');
  assert.strictEqual(byId.aluminum, 'aluminum');
});
