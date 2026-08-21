import { test } from 'node:test';
import assert from 'node:assert';
import { severityPill } from './resultsModel.js';

test('possible tier → warning / Worth checking', () => {
  assert.deepStrictEqual(severityPill({ tier: 'possible', severity: 'high' }), { variant: 'warning', label: 'Worth checking' });
});
test('high severity → danger / High concern', () => {
  assert.deepStrictEqual(severityPill({ severity: 'high' }), { variant: 'danger', label: 'High concern' });
});
test('moderate severity → warning / Moderate concern', () => {
  assert.deepStrictEqual(severityPill({ severity: 'moderate' }), { variant: 'warning', label: 'Moderate concern' });
});
test('anything else → neutral / Flagged', () => {
  assert.deepStrictEqual(severityPill({}), { variant: 'neutral', label: 'Flagged' });
  assert.deepStrictEqual(severityPill({ severity: 'low' }), { variant: 'neutral', label: 'Flagged' });
});
