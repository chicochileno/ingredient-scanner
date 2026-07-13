const test = require('node:test');
const assert = require('node:assert');
const { matchTextsForProfiles } = require('./userMatchData');

const profilesData = [
  { id: 'p1', name: 'Emma', activeCategories: ['dairy'], personalAllergens: [], dismissedIds: new Set() },
  { id: 'p2', name: 'Liam', activeCategories: ['dyes', 'dairy'], personalAllergens: [], dismissedIds: new Set() },
];

test('matches each item against every profile, keyed by itemId', () => {
  const items = [
    { itemId: 'a', rawText: 'Sugar, Red 40, Salt' },
    { itemId: 'b', rawText: 'Water, Milk' },
  ];
  const results = matchTextsForProfiles(profilesData, items);
  assert.strictEqual(results.length, 2);
  const a = results.find((r) => r.itemId === 'a');
  const aEmma = a.profiles.find((p) => p.profileId === 'p1');
  const aLiam = a.profiles.find((p) => p.profileId === 'p2');
  assert.strictEqual(aEmma.flagged.length, 0);
  assert.ok(aLiam.flagged.find((f) => f.id === 'red40'));
  const b = results.find((r) => r.itemId === 'b');
  assert.ok(b.profiles.find((p) => p.profileId === 'p1').flagged.find((f) => f.id === 'casein'));
  assert.ok(b.profiles.find((p) => p.profileId === 'p2').flagged.find((f) => f.id === 'casein'));
});

test('each result profile carries counts and name', () => {
  const results = matchTextsForProfiles(profilesData, [{ itemId: 'a', rawText: 'Red 40' }]);
  const liam = results[0].profiles.find((p) => p.profileId === 'p2');
  assert.strictEqual(liam.name, 'Liam');
  assert.strictEqual(liam.counts.high, 1);
});

test('blank rawText yields empty flags for all profiles', () => {
  const results = matchTextsForProfiles(profilesData, [{ itemId: 'x', rawText: '' }]);
  assert.strictEqual(results[0].profiles.every((p) => p.flagged.length === 0), true);
});

test('empty items array returns empty results', () => {
  assert.deepStrictEqual(matchTextsForProfiles(profilesData, []), []);
});
