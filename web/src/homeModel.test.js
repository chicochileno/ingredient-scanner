import { test } from 'node:test';
import assert from 'node:assert';
import { profileAvatar, scanCardModel } from './homeModel.js';

test('profileAvatar: initial from name, deterministic color', () => {
  const a = profileAvatar({ id: 'p1', name: 'Mom', order: 0 });
  assert.strictEqual(a.initial, 'M');
  assert.match(a.color, /^#[0-9A-Fa-f]{6}$/);
  // deterministic: same profile → same color
  assert.strictEqual(profileAvatar({ id: 'p1', name: 'Mom', order: 0 }).color, a.color);
});

test('profileAvatar: fallback initial when no name', () => {
  assert.strictEqual(profileAvatar({ id: 'x', name: null, order: 2 }).initial, '?');
  assert.strictEqual(profileAvatar({ id: 'x' }).initial, '?');
});

test('scanCardModel: product name + safe when no flags', () => {
  const m = scanCardModel({ productName: 'Almond Milk', imageUrl: 'u', flagged: [], mode: 'barcode' });
  assert.strictEqual(m.name, 'Almond Milk');
  assert.strictEqual(m.imageUrl, 'u');
  assert.strictEqual(m.status, 'safe');
  assert.strictEqual(m.label, 'Safe');
});

test('scanCardModel: flagged with count', () => {
  const m = scanCardModel({ productName: 'Cereal', flagged: [{ severity: 'high' }, { severity: 'low' }], mode: 'camera' });
  assert.strictEqual(m.status, 'flagged');
  assert.strictEqual(m.label, 'Flagged (2)');
});

test('scanCardModel: mode-based name fallback', () => {
  assert.strictEqual(scanCardModel({ mode: 'barcode', flagged: [] }).name, 'Barcode scan');
  assert.strictEqual(scanCardModel({ mode: 'camera', flagged: [] }).name, 'Label scan');
  assert.strictEqual(scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [] } }).name, 'Menu scan');
});

test('scanCardModel: menu scan flagged from snapshot', () => {
  const safe = scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [{ flaggedCount: 0 }] } });
  assert.strictEqual(safe.status, 'safe');
  const flagged = scanCardModel({ mode: 'menu', menuSnapshot: { profiles: [{ flaggedCount: 3 }, { flaggedCount: 0 }] } });
  assert.strictEqual(flagged.status, 'flagged');
});

import { scanModeBadge } from './homeModel.js';

test('scanModeBadge maps modes (camera/unknown → label)', () => {
  assert.deepStrictEqual(scanModeBadge('barcode'), { key: 'barcode', label: 'Barcode scan' });
  assert.deepStrictEqual(scanModeBadge('menu'), { key: 'menu', label: 'Menu scan' });
  assert.deepStrictEqual(scanModeBadge('camera'), { key: 'label', label: 'Label scan' });
  assert.deepStrictEqual(scanModeBadge(undefined), { key: 'label', label: 'Label scan' });
});
