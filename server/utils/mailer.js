const { Resend } = require('resend');

let defaultClient = null;
function getClient() {
  if (!defaultClient) defaultClient = new Resend(process.env.RESEND_API_KEY);
  return defaultClient;
}

// Emails the owner a copy of a support submission via Resend.
// Reply-To is the submitter so the owner can just hit reply.
// Returns the Resend `data`; throws if Resend returns an `error`.
async function sendSupportEmail({ subject, message, email, name }, { client } = {}) {
  const resend = client || getClient();
  const to = process.env.SUPPORT_TO || 'joel.rogers.design@gmail.com';
  const from = process.env.SUPPORT_FROM || 'onboarding@resend.dev';
  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo: email || undefined,
    subject: `[IngredientScan Support] ${subject}`,
    text: `From: ${name || 'Unknown'} <${email || 'no email'}>\n\n${message}`,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return data;
}

module.exports = { sendSupportEmail };
