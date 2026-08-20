import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { headerForRoute } from './headerModel';
import AccountMenu from './AccountMenu';
import './AppHeader.css';

function AboutSheet({ onClose }) {
  return (
    <div className="about-sheet" role="dialog" aria-modal="true" aria-label="How are ingredients flagged">
      <div className="about-card">
        <h2 className="about-title">How are ingredients flagged?</h2>
        <p>Each profile has a set of ingredient categories to watch for. When you scan a product or menu, we check the ingredients against every profile's list and flag anything that matches — always as guidance, not a guarantee.</p>
        <button className="about-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function AppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const { title, showLogo, backTo } = headerForRoute(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-left">
        {showLogo || !backTo ? (
          <span className="app-header-logo">{title || 'IngredientScan'}</span>
        ) : (
          <button className="app-header-back" aria-label="Back" onClick={() => navigate(backTo)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            <span className="app-header-title">{title}</span>
          </button>
        )}
      </div>
      <div className="app-header-account">
        <button className="app-header-avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          {user?.photoURL
            ? <img className="app-header-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            : <span className="app-header-avatar app-header-avatar-fallback">{(user?.displayName || '?')[0]}</span>}
        </button>
        {menuOpen && <AccountMenu onClose={() => setMenuOpen(false)} onAbout={() => setShowAbout(true)} />}
      </div>
      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
    </header>
  );
}
