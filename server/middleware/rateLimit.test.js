const test = require('node:test');
const assert = require('node:assert');
const { createRateLimiter } = require('./rateLimit');

function fakeRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

test('allows up to the limit then 429s within the window', () => {
  const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => 1000 });
  const req = { ip: '1.2.3.4' };
  let nextCalls = 0;
  const next = () => { nextCalls++; };
  for (let i = 0; i < 3; i++) { const res = fakeRes(); limiter(req, res, next); assert.strictEqual(res.statusCode, 200); }
  const res = fakeRes();
  limiter(req, res, next);
  assert.strictEqual(res.statusCode, 429);
  assert.strictEqual(nextCalls, 3);
});

test('resets after the window elapses', () => {
  let t = 1000;
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
  const req = { ip: '9.9.9.9' };
  const next = () => {};
  let res = fakeRes(); limiter(req, res, next); assert.strictEqual(res.statusCode, 200);
  res = fakeRes(); limiter(req, res, next); assert.strictEqual(res.statusCode, 429);
  t = 2100; // past the window
  res = fakeRes(); limiter(req, res, next); assert.strictEqual(res.statusCode, 200);
});

test('separate IPs have separate counters', () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => 5 });
  const next = () => {};
  let res = fakeRes(); limiter({ ip: 'a' }, res, next); assert.strictEqual(res.statusCode, 200);
  res = fakeRes(); limiter({ ip: 'b' }, res, next); assert.strictEqual(res.statusCode, 200);
});
