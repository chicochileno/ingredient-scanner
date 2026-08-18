// Pure validation/normalization for a support submission. No IO.
// Returns { ok:true, value:{ subject, message } } or { ok:false, error }.
function validateSupportInput({ subject, message } = {}) {
  if (typeof message !== 'string' || message.trim().length < 1) {
    return { ok: false, error: 'Message is required.' };
  }
  const trimmedMsg = message.trim();
  if (trimmedMsg.length > 5000) {
    return { ok: false, error: 'Message is too long (max 5000 characters).' };
  }
  let subj = typeof subject === 'string' ? subject.trim() : '';
  if (!subj) subj = 'Support request';
  if (subj.length > 200) subj = subj.slice(0, 200);
  return { ok: true, value: { subject: subj, message: trimmedMsg } };
}

module.exports = { validateSupportInput };
