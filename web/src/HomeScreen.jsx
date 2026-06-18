import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAllergenContext } from './useAllergens';
import './HomeScreen.css';

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function AboutSheet({ onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-scroll">
          <h2 className="sheet-title">How we flag ingredients</h2>
          <p className="sheet-body">
            Every ingredient is checked against a curated database built from sources
            used in autism dietary research and intervention programs.
          </p>

          <div className="sheet-sources">
            <div className="sheet-source">
              <p className="sheet-source-name">Feingold Association</p>
              <p className="sheet-source-desc">Dietary guidelines linking artificial additives to behavioral changes in children.</p>
            </div>
            <div className="sheet-source">
              <p className="sheet-source-name">TACA Dietary Guidelines</p>
              <p className="sheet-source-desc">Talk About Curing Autism's evidence-based elimination diet recommendations (GFCF, SCD).</p>
            </div>
            <div className="sheet-source">
              <p className="sheet-source-name">Gut-Brain Axis Research</p>
              <p className="sheet-source-desc">Peer-reviewed studies on excitotoxins, casein, gluten, and their neurological effects.</p>
            </div>
          </div>

          <h3 className="sheet-subtitle">What we flag</h3>
          <div className="sheet-tags">
            {['Artificial dyes', 'Artificial preservatives', 'MSG & excitotoxins', 'Gluten sources', 'Casein & dairy proteins', 'High-fructose corn syrup', 'Artificial sweeteners', 'Carrageenan'].map(tag => (
              <span key={tag} className="sheet-tag">{tag}</span>
            ))}
          </div>

          <p className="sheet-disclaimer">
            This app is for informational purposes only and is not a substitute for medical
            or nutritional advice. Always consult a qualified professional before making
            dietary changes.
          </p>
        </div>
        <button className="sheet-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function HomeScreen({ user, onScan, onHistory, onAllergens }) {
  const firstName = user.displayName?.split(' ')[0] || 'there';
  const [showAbout, setShowAbout] = useState(false);
  const { allergens } = useAllergenContext();

  return (
    <div className="home-root">
      <div className="home-header">
        <div className="home-user">
          {user.photoURL
            ? <img className="home-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            : <div className="home-avatar home-avatar-fallback">{firstName[0]}</div>
          }
          <div className="home-user-info">
            <p className="home-greeting">Hi, {firstName}</p>
            <button className="home-signout" onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="home-content">
        <div className="home-brand">
          <img src="/favicon.png" width="72" height="72" alt="" style={{ borderRadius: 18, display: 'block', margin: '0 auto 16px' }} />
          <h1 className="home-title">Ingredient<br />Scanner</h1>
          <p className="home-sub">Know what's in your child's food.</p>
        </div>

        <div className="home-cards">
          <button className="home-card home-card-scan" onClick={onScan}>
            <span className="home-card-icon"><CameraIcon /></span>
            <span className="home-card-label">Scan</span>
            <span className="home-card-desc">Label or barcode</span>
          </button>

          <button className="home-card home-card-history" onClick={onHistory}>
            <span className="home-card-icon"><HistoryIcon /></span>
            <span className="home-card-label">History</span>
            <span className="home-card-desc">View past scans</span>
          </button>

          <button className="home-card home-card-allergens" onClick={onAllergens}>
            <span className="home-card-icon"><ShieldIcon /></span>
            <span className="home-card-label">My Allergens</span>
            <span className="home-card-desc">
              {allergens.length > 0
                ? `${allergens.length} item${allergens.length !== 1 ? 's' : ''}`
                : 'None set'}
            </span>
            {allergens.length > 0 && (
              <span className="home-allergen-badge">{allergens.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="home-footer">
        <button className="home-footer-btn" onClick={() => setShowAbout(true)}>
          How are ingredients flagged?
        </button>
      </div>

      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
    </div>
  );
}
