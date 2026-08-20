import { useNavigate } from 'react-router-dom';
import { useProfileContext } from './useProfiles';
import { useBillingContext } from './useBilling';
import { useRecentScans } from './useRecentScans';
import { profileAvatar, scanCardModel, scanModeBadge } from './homeModel';
import './HomeScreen.css';

export default function HomeScreen({ user, onUpgrade }) {
  const navigate = useNavigate();
  const { profiles } = useProfileContext();
  const { scanCount, subscriptionStatus, loading: billingLoading } = useBillingContext();
  const { scans } = useRecentScans(user, 8);

  const isSubscribed = subscriptionStatus === 'active';
  const atLimit = !isSubscribed && scanCount >= 10;

  return (
    <div className="home">
      {!isSubscribed && !billingLoading && (
        <button className="home-upgrade" onClick={onUpgrade}>
          <span className="home-upgrade-text">{atLimit ? 'Free scans used up' : `${scanCount} of 10 free scans used`}</span>
          <span className="home-upgrade-cta">Upgrade</span>
          <span className="home-upgrade-bar"><span className="home-upgrade-fill" style={{ width: `${Math.min((scanCount / 10) * 100, 100)}%` }} /></span>
        </button>
      )}

      <section className="home-profiles" aria-label="Family profiles">
        <h2 className="home-section-title">Family Profiles</h2>
        <div className="home-profiles-row">
          {profiles.map((p) => {
            const av = profileAvatar(p);
            const cats = (p.activeCategories || []).length;
            return (
              <button key={p.id} className="profile-card" onClick={() => navigate(`/profiles/${p.id}`)}>
                <span className="profile-avatar" style={{ background: av.color }}>{av.initial}</span>
                <span className="profile-name">{p.name || 'Unnamed'}</span>
                <span className="profile-summary">{cats > 0 ? `${cats} categor${cats === 1 ? 'y' : 'ies'}` : 'None'}</span>
              </button>
            );
          })}
          <AddProfileCard onAdded={(id) => navigate(`/profiles/${id}`)} />
        </div>
      </section>

      <section className="home-history" aria-label="Scan history">
        <div className="home-history-head">
          <h2 className="home-section-title">Scan History</h2>
          <button className="home-viewall" onClick={() => navigate('/history')}>View All</button>
        </div>
        <div className="home-history-scroll">
          {scans.length === 0 ? (
            <p className="home-empty">No scans yet — tap the scan button below to check your first product.</p>
          ) : (
            <div className="home-history-grid">
              {scans.map((s) => {
                const m = scanCardModel(s);
                return (
                  <button key={s.id} className="scan-card" onClick={() => navigate(`/history/${s.id}`, { state: { scan: s } })}>
                    <span className="scan-card-img">
                      {(() => {
                        const badge = scanModeBadge(s.mode);
                        return (
                          <>
                            {m.imageUrl
                              ? <img src={m.imageUrl} alt="" />
                              : <span className="scan-card-noimg">{badge.key === 'barcode' ? '||I|I||' : badge.key === 'menu' ? '≣' : '⊟'}</span>}
                            <span className={`scan-mode-badge scan-mode-${badge.key}`} aria-label={badge.label}>
                              {badge.key === 'barcode'
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" /></svg>
                                : badge.key === 'menu'
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v18M6 8h3M18 3c-2 0-3 2-3 5s1 4 3 4v9" /></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6 9.5 3h5L16 6" /><circle cx="12" cy="13" r="3" /></svg>}
                            </span>
                          </>
                        );
                      })()}
                    </span>
                    <span className="scan-card-name">{m.name}</span>
                    <span className={`scan-pill scan-pill-${m.status}`}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AddProfileCard({ onAdded }) {
  const { addProfile } = useProfileContext();
  return (
    <button className="profile-card profile-card-add" onClick={async () => onAdded(await addProfile(''))}>
      <span className="profile-avatar profile-avatar-add">+</span>
      <span className="profile-name">Add profile</span>
    </button>
  );
}
