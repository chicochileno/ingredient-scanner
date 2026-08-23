import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { to: '/home', label: 'Home', icon: (
    <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />
  ) },
  { to: '/history', label: 'History', icon: (
    <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
  ) },
  { to: '/profiles', label: 'Profiles', icon: (
    <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>
  ) },
  { to: '/lists', label: 'Lists', icon: (
    <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>
  ) },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottomnav" aria-label="Main">
      <div className="bottomnav-tabs">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.to} tab={t} active={pathname === t.to} onClick={() => navigate(t.to)} />
        ))}
        <div className="bottomnav-scan">
          <button className="bottomnav-fab" aria-label="Scan" onClick={() => navigate('/scan')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10" />
            </svg>
          </button>
          <span className="bottomnav-fab-spacer" aria-hidden="true" />
          <span className="bottomnav-label">Scan</span>
        </div>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.to} tab={t} active={pathname === t.to} onClick={() => navigate(t.to)} />
        ))}
      </div>
    </nav>
  );
}

function TabButton({ tab, active, onClick }) {
  return (
    <button
      className={`bottomnav-tab ${active ? 'bottomnav-tab-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tab.icon}
      </svg>
      <span className="bottomnav-label">{tab.label}</span>
    </button>
  );
}
