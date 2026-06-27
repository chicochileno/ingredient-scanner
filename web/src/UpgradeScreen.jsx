import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession } from './api';
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
      <button className="upgrade-back" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

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
          className="upgrade-btn"
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

  useEffect(() => {
    const t = setTimeout(() => navigate('/home', { replace: true }), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="upgrade-root upgrade-success-root">
      <div className="upgrade-content">
        <div className="upgrade-icon">🎉</div>
        <h1 className="upgrade-title">You're all set!</h1>
        <p className="upgrade-sub">Your subscription is active.<br />Scan unlimited products.</p>
        <button className="upgrade-btn" onClick={() => navigate('/home', { replace: true })}>
          Start scanning
        </button>
      </div>
    </div>
  );
}
