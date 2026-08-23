import { useState, useRef, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { CURRENT_TERMS_VERSION } from './legal';
import './TermsGate.css';

export default function TermsGate({ user }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);
  const cardRef = useRef(null);

  // Move focus into the dialog on open, and trap Tab within it.
  useEffect(() => {
    if (titleRef.current) titleRef.current.focus();
    const card = cardRef.current;
    if (!card) return;
    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const items = card.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])');
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    card.addEventListener('keydown', onKeyDown);
    return () => card.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleAccept() {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'legal', 'acceptance'),
        { acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: serverTimestamp() },
        { merge: true }
      );
      // useLegal's onSnapshot flips the gate off automatically — no navigation needed.
    } catch (e) {
      console.error('Failed to save acceptance:', e);
      setError('Could not save your acceptance. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="terms-gate-overlay">
      <div className="ui-card terms-gate-card" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <h1 id="terms-gate-title" className="terms-gate-title" tabIndex={-1} ref={titleRef}>Before you start</h1>
        <p className="terms-gate-intro">Please review and accept how this app works.</p>
        <ul className="terms-gate-points">
          <li>Results are <strong>informational only</strong> and <strong>not a guarantee</strong>.</li>
          <li>Automated/AI analysis can make mistakes — <strong>especially Restaurant Mode menu scans</strong>, which infer <em>likely</em> ingredients from menu wording and can miss ingredients a menu doesn’t list.</li>
          <li>Always <strong>confirm with restaurant staff and product labels</strong>.</li>
          <li>This is <strong>not medical or nutritional advice</strong>. You are responsible for your dietary decisions.</li>
        </ul>
        <p className="terms-gate-links">
          Read the full{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <label className="terms-gate-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {error && <p className="terms-gate-error" role="alert">{error}</p>}
        <button className="ui-btn ui-btn-primary terms-gate-accept" onClick={handleAccept} disabled={!checked || saving}>
          {saving ? 'Saving…' : 'Agree & Continue'}
        </button>
        <button className="terms-gate-signout" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </div>
  );
}
