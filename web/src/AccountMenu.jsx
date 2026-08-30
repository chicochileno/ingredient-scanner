import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOutEverywhere } from './auth';
import { useBillingContext } from './useBilling';
import { createCustomerPortalSession } from './api';
import './AccountMenu.css';

export default function AccountMenu({ onClose, onAbout }) {
  const navigate = useNavigate();
  const { subscriptionStatus } = useBillingContext();
  const isSubscribed = subscriptionStatus === 'active';
  const ref = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (firstItemRef.current) firstItemRef.current.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll('button');
        if (!items || items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  async function manageSubscription() {
    try {
      const { url } = await createCustomerPortalSession();
      if (url) window.location.href = url;
    } catch (e) { console.error('Portal error:', e); }
  }

  return (
    <div className="account-menu" role="menu" ref={ref}>
      <button ref={firstItemRef} role="menuitem" className="account-item" onClick={() => signOutEverywhere()}>Sign out</button>
      {isSubscribed && (
        <button role="menuitem" className="account-item" onClick={manageSubscription}>Manage subscription</button>
      )}
      <div className="account-divider" />
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/terms'); }}>Terms of Service</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/privacy'); }}>Privacy Policy</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); onAbout(); }}>How are ingredients flagged</button>
      <button role="menuitem" className="account-item account-item-sub" onClick={() => { onClose(); navigate('/support'); }}>Support</button>
    </div>
  );
}
