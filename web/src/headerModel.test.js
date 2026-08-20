import { test } from 'node:test';
import assert from 'node:assert';
import { headerForRoute } from './headerModel.js';

test('tab routes: logo, no back', () => {
  for (const [p, title] of [['/home', 'IngredientScan'], ['/history', 'History'], ['/profiles', 'Profiles'], ['/lists', 'Lists']]) {
    const h = headerForRoute(p);
    assert.strictEqual(h.title, title);
    assert.strictEqual(h.showLogo, true);
    assert.strictEqual(h.backTo, null);
  }
});

test('deep routes: title + parent back, no logo', () => {
  assert.deepStrictEqual(headerForRoute('/results'), { title: 'Results', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/menu-results'), { title: 'Menu Results', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/support'), { title: 'Support', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/upgrade'), { title: 'Upgrade', showLogo: false, backTo: '/home' });
  assert.deepStrictEqual(headerForRoute('/upgrade/success'), { title: 'Upgrade', showLogo: false, backTo: '/home' });
});

test('dynamic routes: parent back', () => {
  assert.deepStrictEqual(headerForRoute('/history/abc'), { title: 'Scan', showLogo: false, backTo: '/history' });
  assert.deepStrictEqual(headerForRoute('/lists/xyz'), { title: 'List', showLogo: false, backTo: '/lists' });
  assert.deepStrictEqual(headerForRoute('/profiles/p1'), { title: 'Edit Profile', showLogo: false, backTo: '/profiles' });
});

test('unknown route: safe default', () => {
  assert.deepStrictEqual(headerForRoute('/whatever'), { title: '', showLogo: true, backTo: null });
});
