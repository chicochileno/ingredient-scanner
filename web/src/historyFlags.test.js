import { test } from 'node:test';
import assert from 'node:assert';
import { perProfileFromRematch, perProfileFromMenu, statusPills } from './historyFlags.js';

test('perProfileFromRematch: name + flagged.length; null name → Unnamed', () => {
  assert.deepStrictEqual(
    perProfileFromRematch([{ name: 'Rosa', flagged: [1] }, { name: 'Anne', flagged: [1, 2] }, { name: null, flagged: [] }]),
    [{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 2 }, { name: 'Unnamed', count: 0 }]
  );
});

test('perProfileFromMenu: name + flaggedCount', () => {
  assert.deepStrictEqual(
    perProfileFromMenu([{ name: 'Rosa', flaggedCount: 1 }, { name: 'Anne', flaggedCount: 0 }]),
    [{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 0 }]
  );
});

test('statusPills: solo → single Safe/Flagged pill', () => {
  assert.deepStrictEqual(statusPills([{ name: 'X', count: 0 }]), [{ label: 'Safe', variant: 'safe' }]);
  assert.deepStrictEqual(statusPills([{ name: 'X', count: 3 }]), [{ label: 'Flagged (3)', variant: 'danger' }]);
  assert.deepStrictEqual(statusPills([]), [{ label: 'Safe', variant: 'safe' }]);
});

test('statusPills: multi → per-person pills', () => {
  assert.deepStrictEqual(
    statusPills([{ name: 'Rosa', count: 1 }, { name: 'Anne', count: 2 }]),
    [{ label: 'Rosa 1', variant: 'danger' }, { label: 'Anne 2', variant: 'danger' }]
  );
  assert.deepStrictEqual(
    statusPills([{ name: 'Bob', count: 0 }, { name: 'Anne', count: 2 }]),
    [{ label: 'Bob 0', variant: 'safe' }, { label: 'Anne 2', variant: 'danger' }]
  );
});
