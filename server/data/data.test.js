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
