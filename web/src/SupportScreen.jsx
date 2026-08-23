import { useState } from 'react';
import { auth } from './firebase';
import { submitSupport } from './api';
import './SupportScreen.css';

export default function SupportScreen({ onBack }) {
  const user = auth.currentUser;
  const [subject, setSubject] = useState('Support request');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending' || !message.trim()) return;
    setStatus('sending');
    setError(null);
    try {
      await submitSupport({ subject, message });
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  return (
    <div className="support-root">
      <div className="support-scroll">

        {status === 'sent' ? (
          <div className="support-sent" role="status">
            <p className="support-sent-title">Thanks — we got your message.</p>
            <p className="support-sent-sub">We’ll get back to you{user?.email ? ` at ${user.email}` : ''}.</p>
            <button className="ui-btn ui-btn-primary" onClick={onBack}>Back to app</button>
          </div>
        ) : (
          <form className="support-form" onSubmit={handleSubmit}>
            <p className="support-sending-as">
              Sending as {user?.displayName || 'you'}{user?.email ? ` · ${user.email}` : ''}
            </p>

            <label className="support-label" htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              className="ui-input"
              type="text"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />

            <label className="support-label" htmlFor="support-message">How can we help?</label>
            <textarea
              id="support-message"
              className="ui-input support-textarea"
              value={message}
              maxLength={5000}
              rows={8}
              placeholder="Describe your question or issue…"
              onChange={(e) => setMessage(e.target.value)}
            />

            {error && <p className="support-error" role="alert">{error}</p>}

            <button className="ui-btn ui-btn-primary" type="submit" disabled={status === 'sending' || !message.trim()}>
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
