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

test('every category has a non-empty description', () => {
  for (const c of CATEGORIES) {
    assert.ok(typeof c.description === 'string' && c.description.length > 0, `missing description for ${c.key}`);
  }
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

const { PRESETS } = require('./presets');

test('presets: every preset category is a valid canonical key', () => {
  for (const p of PRESETS) {
    assert.ok(p.key && p.label, `preset needs key+label`);
    assert.ok(Array.isArray(p.categories) && p.categories.length > 0);
    for (const c of p.categories) {
      assert.ok(KEYS.includes(c), `preset "${p.key}" references unknown category "${c}"`);
    }
  }
});

test('presets: autism includes all categories; focused presets are subsets', () => {
  const autism = PRESETS.find((p) => p.key === 'autism');
  assert.deepStrictEqual([...autism.categories].sort(), [...KEYS].sort());
  const dairyFree = PRESETS.find((p) => p.key === 'dairy-free');
  assert.deepStrictEqual(dairyFree.categories, ['dairy']);
  const feingold = PRESETS.find((p) => p.key === 'feingold');
  assert.deepStrictEqual([...feingold.categories].sort(), ['artificial-flavors', 'dyes', 'preservatives']);
});
