const test = require('node:test');
const assert = require('node:assert');
const { buildProfileShare, buildListShare, isValidShareId } = require('./shareData');

test('buildProfileShare maps active categories to labels + allergen names', () => {
  const out = buildProfileShare(
    { name: 'Emma', activeCategories: ['dyes', 'dairy'] },
    [{ name: 'onion' }]
  );
  assert.strictEqual(out.type, 'profile');
  assert.strictEqual(out.title, 'Emma');
  assert.ok(out.avoid.includes('Artificial Dyes'));
  assert.ok(out.avoid.includes('Dairy / Casein'));
  assert.ok(out.avoid.includes('onion'));
});

test('buildProfileShare falls back to a default title', () => {
  const out = buildProfileShare({ name: null, activeCategories: [] }, []);
  assert.strictEqual(out.title, 'Food profile');
  assert.deepStrictEqual(out.avoid, []);
});

test('buildListShare tags scanned items safe/flagged for the profile; manual = unscanned', () => {
  const inputs = { activeCategories: ['dyes'], personalAllergens: [], dismissedIds: new Set() };
  const items = [
    { kind: 'scanned', name: 'Red candy', rawText: 'Sugar, Red 40' },
    { kind: 'scanned', name: 'Rice cakes', rawText: 'Rice, Salt' },
    { kind: 'manual', name: 'Bananas' },
  ];
  const out = buildListShare('School snacks', 'Emma', items, inputs);
  assert.strictEqual(out.type, 'list');
  assert.strictEqual(out.title, 'School snacks');
  assert.strictEqual(out.childName, 'Emma');
  const byName = Object.fromEntries(out.items.map((i) => [i.name, i.status]));
  assert.strictEqual(byName['Red candy'], 'flagged');
  assert.strictEqual(byName['Rice cakes'], 'safe');
  assert.strictEqual(byName['Bananas'], 'unscanned');
});

test('isValidShareId accepts URL-safe tokens 16-64 chars, rejects others', () => {
  assert.ok(isValidShareId('abcDEF012_-ghijkl'));
  assert.ok(!isValidShareId('short'));
  assert.ok(!isValidShareId('has/slash/and.dot'));
  assert.ok(!isValidShareId(''));
  assert.ok(!isValidShareId(null));
});
