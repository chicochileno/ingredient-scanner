import { signOut } from 'firebase/auth';
import { auth } from './firebase';
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

export default function HomeScreen({ user, onScan, onHistory }) {
  const firstName = user.displayName?.split(' ')[0] || 'there';

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
        </div>
      </div>
    </div>
  );
}
