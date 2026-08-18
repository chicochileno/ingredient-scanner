const { test } = require('node:test');
const assert = require('node:assert');
const { sendSupportEmail } = require('./mailer');

function fakeResend(capture, result = { data: { id: 'abc' }, error: null }) {
  return { emails: { send: async (payload) => { capture.payload = payload; return result; } } };
}

test('sends with owner default To, submitter Reply-To, and prefixed subject', async () => {
  delete process.env.SUPPORT_TO;
  delete process.env.SUPPORT_FROM;
  const cap = {};
  await sendSupportEmail(
    { subject: 'Need help', message: 'It broke', email: 'user@example.com', name: 'Jane' },
    { client: fakeResend(cap) }
  );
  assert.strictEqual(cap.payload.to, 'joel.rogers.design@gmail.com');
  assert.strictEqual(cap.payload.from, 'onboarding@resend.dev');
  assert.strictEqual(cap.payload.replyTo, 'user@example.com');
  assert.strictEqual(cap.payload.subject, '[IngredientScan Support] Need help');
  assert.match(cap.payload.text, /It broke/);
  assert.match(cap.payload.text, /Jane/);
});

test('respects SUPPORT_TO / SUPPORT_FROM overrides', async () => {
  process.env.SUPPORT_TO = 'ops@ingredientscan.app';
  process.env.SUPPORT_FROM = 'Support <help@ingredientscan.app>';
  const cap = {};
  await sendSupportEmail({ subject: 'x', message: 'y', email: 'a@b.com', name: 'A' }, { client: fakeResend(cap) });
  assert.strictEqual(cap.payload.to, 'ops@ingredientscan.app');
  assert.strictEqual(cap.payload.from, 'Support <help@ingredientscan.app>');
  delete process.env.SUPPORT_TO;
  delete process.env.SUPPORT_FROM;
});

test('throws when Resend returns an error', async () => {
  const client = { emails: { send: async () => ({ data: null, error: { message: 'bad key' } }) } };
  await assert.rejects(
    () => sendSupportEmail({ subject: 's', message: 'm', email: 'a@b.com', name: 'A' }, { client }),
    /bad key/
  );
});
