import { useState } from 'react';
import './ResultsScreen.css';
import './MenuResultsScreen.css';

const CAVEAT =
  "Menus don't list full ingredients. These are AI estimates of what dishes likely contain — always confirm with your server. Not a safety guarantee.";

export default function MenuResultsScreen({ result, onScanAgain, onBack }) {
  const dishes = result.dishes || [];
  const profiles = result.profiles || [];
  const multi = profiles.length > 1;
  const [selectedId, setSelectedId] = useState(profiles[0]?.profileId ?? null);
  const selected = profiles.find((p) => p.profileId === selectedId) || profiles[0] || null;

  const isFlagged = (dish) =>
    selected ? (dish.perProfile.find((pp) => pp.profileId === selected.profileId)?.flagged ?? false) : false;
  const avoid = dishes.filter(isFlagged);
  const ok = dishes.filter((d) => !isFlagged(d));

  return (
    <div className="menu-results-root">
      <div className="menu-results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
        )}

        <div className="menu-caveat" role="note">{CAVEAT}</div>

        {result.noDishes && (
          <p className="menu-empty">We couldn't identify dishes from this menu. Try a clearer photo or paste the menu text.</p>
        )}

        {multi && (
          <div className="profile-chips" role="tablist" aria-label="Children">
            {profiles.map((p) => {
              const isSel = p.profileId === selectedId;
              const name = p.name || 'Unnamed';
              return (
                <button key={p.profileId} role="tab" aria-selected={isSel}
                  className={`profile-chip ${p.flaggedCount > 0 ? 'profile-chip-flagged' : 'profile-chip-safe'} ${isSel ? 'profile-chip-sel' : ''}`}
                  onClick={() => setSelectedId(p.profileId)}>
                  {name} — {p.flaggedCount > 0 ? `${p.flaggedCount} to avoid` : 'looks OK'}
                </button>
              );
            })}
          </div>
        )}

        {avoid.length > 0 && (
          <section className="menu-section">
            <h2 className="menu-section-title menu-section-avoid">Avoid / check{multi && selected ? ` — ${selected.name || 'Unnamed'}` : ''}</h2>
            <div className="menu-dishes">
              {avoid.map((d, i) => (
                <div className="menu-dish menu-dish-avoid" key={`a-${i}`}>
                  <span className="menu-dish-name">{d.name}</span>
                  {d.categoryLabels.length > 0 && (
                    <div className="menu-dish-chips">
                      {d.categoryLabels.map((label) => <span key={label} className="menu-chip">likely {label}</span>)}
                    </div>
                  )}
                  {d.allergens.length > 0 && <div className="menu-dish-allergens">Allergens: {d.allergens.join(', ')}</div>}
                  {d.note && <p className="menu-dish-note">{d.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {ok.length > 0 && (
          <section className="menu-section">
            <h2 className="menu-section-title menu-section-ok">Looks OK</h2>
            <div className="menu-dishes">
              {ok.map((d, i) => (
                <div className="menu-dish menu-dish-ok" key={`o-${i}`}>
                  <span className="menu-dish-name">{d.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="disclaimer">Likely, not a guarantee. For informational purposes only — always confirm with restaurant staff. Not a substitute for medical or nutritional advice.</p>
      </div>
      <div className="menu-results-footer">
        <button className="scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
      </div>
    </div>
  );
}
