import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession } from './api';
import { useBillingContext } from './useBilling';
import './UpgradeScreen.css';

export function UpgradeScreen({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="upgrade-root">
      <div className="upgrade-content">
        <div className="upgrade-icon">🌿</div>
        <h1 className="upgrade-title">Upgrade to<br />Unlimited</h1>
        <p className="upgrade-sub">
          You've used your 10 free scans.<br />
          Keep scanning for $5/month.
        </p>

        <div className="upgrade-features">
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Unlimited scans</p>
              <p className="upgrade-feature-desc">Scan as many products as you need</p>
            </div>
          </div>
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Personal allergen tracking</p>
              <p className="upgrade-feature-desc">Flag your custom ingredients in every scan</p>
            </div>
          </div>
          <div className="upgrade-feature">
            <span className="upgrade-check">✓</span>
            <div>
              <p className="upgrade-feature-name">Full scan history</p>
              <p className="upgrade-feature-desc">Review all past scans anytime</p>
            </div>
          </div>
        </div>

        {error && <p className="upgrade-error">{error}</p>}

        <button
          className="ui-btn ui-btn-primary upgrade-btn"
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? <span className="upgrade-spinner" /> : 'Upgrade — $5/month'}
        </button>
        <p className="upgrade-legal">Cancel anytime · Secure payment via Stripe</p>
      </div>
    </div>
  );
}

export function UpgradeSuccessScreen() {
  const navigate = useNavigate();
  const { subscriptionStatus } = useBillingContext();
  const isActive = subscriptionStatus === 'active';
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => navigate('/home', { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  useEffect(() => {
    const t = setTimeout(() => setWaitedLongEnough(true), 30000);
    return () => clearTimeout(t);
  }, []);

  if (isActive) {
    return (
      <div className="upgrade-root upgrade-success-root">
        <div className="upgrade-content">
          <div className="upgrade-icon">🎉</div>
          <h1 className="upgrade-title">You're all set!</h1>
          <p className="upgrade-sub">Your subscription is active.<br />Scan unlimited products.</p>
          <button className="ui-btn ui-btn-primary upgrade-btn" onClick={() => navigate('/home', { replace: true })}>
            Start scanning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upgrade-root upgrade-success-root">
      <div className="upgrade-content">
        <div className="upgrade-icon">🌿</div>
        <h1 className="upgrade-title">Confirming your<br />subscription…</h1>
        <p className="upgrade-sub">This usually takes a few seconds.</p>
        <span className="upgrade-spinner upgrade-spinner-dark" />
        {waitedLongEnough && (
          <>
            <p className="upgrade-sub" style={{ marginTop: 20 }}>
              Taking longer than expected. Your subscription will activate shortly.
            </p>
            <button className="ui-btn ui-btn-primary upgrade-btn" onClick={() => navigate('/home', { replace: true })}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
