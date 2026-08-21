import { useState } from 'react';
import './ResultsScreen.css';
import './AllergensScreen.css';
import './ListsScreen.css';
import { dismissFlag } from './api';
import SaveToListSheet from './SaveToListSheet';
import { severityPill } from './resultsModel';

function SeverityBadge({ tier, severity }) {
  const { variant, label } = severityPill({ tier, severity });
  return <span className={`ui-pill ui-pill-${variant}`}>{label}</span>;
}

function Sources({ citations }) {
  const [open, setOpen] = useState(false);
  if (!citations || citations.length === 0) return null;
  return (
    <div className="card-sources">
      <button className="card-sources-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide sources' : 'Sources'}
      </button>
      {open && (
        <ul className="card-sources-list">
          {citations.map((c, i) => (
            <li key={c.url ?? i}>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a>
              ) : (
                c.title
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IngredientCard({ item, index, onDismiss }) {
  const isHigh = item.severity === 'high';
  const isPossible = item.tier === 'possible';
  const cardClass = isPossible ? 'card-possible' : isHigh ? 'card-high' : 'card-moderate';
  return (
    <div className={`ui-card card ${cardClass}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-top">
        <div className="card-text">
          <span className="card-flag">{item.flag}</span>
          <span className="card-matched">Found as: {item.matchedOn}</span>
        </div>
        <SeverityBadge tier={item.tier} severity={item.severity} />
      </div>
      <p className="card-explanation">{item.explanation}</p>
      <Sources citations={item.citations} />
      <button className="card-dismiss" onClick={() => onDismiss(item.id)}>
        Not a concern
      </button>
    </div>
  );
}

function ProfileFlags({ profileId, flagged, onDismiss }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  async function handle(id) {
    setDismissed((prev) => new Set(prev).add(id));
    try { await onDismiss(profileId, id); } catch (e) { console.error('Dismiss failed:', e); }
  }
  const visible = flagged
    .filter((f) => !dismissed.has(f.id))
    .map((f) => ({ ...f, tier: f.tier || 'confident', source: f.source || 'curated' }));
  const personal = visible.filter((f) => f.source === 'personal' && f.tier !== 'possible');
  const curated = visible.filter((f) => f.source === 'curated' && f.tier !== 'possible');
  const possible = visible.filter((f) => f.tier === 'possible');
  let idx = 0;
  if (visible.length === 0) {
    return <div className="banner banner-safe"><span className="banner-icon">✓</span>
      <div><p className="banner-title">No flags found</p>
      <p className="banner-sub">Nothing on this profile's list was detected.</p></div></div>;
  }
  return (
    <>
      {personal.length > 0 && (
        <section className="results-section">
          <h2 className="section-title section-title-allergen">Personal Allergens</h2>
          <div className="cards">{personal.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
      {curated.length > 0 && (
        <section className="results-section">
          <h2 className="section-title">Flagged Ingredients</h2>
          <div className="cards">{curated.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
      {possible.length > 0 && (
        <section className="results-section">
          <h2 className="section-title section-title-possible">Worth Checking</h2>
          <div className="cards">{possible.map((it) => <IngredientCard key={it.id} item={it} index={idx++} onDismiss={handle} />)}</div>
        </section>
      )}
    </>
  );
}

export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { rawText = '', productName } = result;
  // Normalize to a profiles array (back-compat: wrap a bare `flagged`)
  const profiles = result.profiles && result.profiles.length
    ? result.profiles
    : [{ profileId: 'default', name: null, flagged: result.flagged || [] }];
  const [selectedId, setSelectedId] = useState(profiles[0].profileId);
  const selected = profiles.find((p) => p.profileId === selectedId) || profiles[0];
  const multi = profiles.length > 1;
  const [showSave, setShowSave] = useState(false);

  async function onDismiss(profileId, ingredientId) {
    await dismissFlag(profileId, ingredientId);
  }

  return (
    <div className="results-root">
      <div className="results-scroll">
        {imageUrl && <div className="ui-preview results-preview"><img src={imageUrl} alt="Scanned item" /></div>}
        <div className="results-header">
          {productName && <h1 className="results-product">{productName}</h1>}
          <p className="results-source">{source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}</p>
        </div>

        {multi && (
          <div className="profile-chips" role="tablist" aria-label="Profiles">
            {profiles.map((p) => {
              const count = (p.flagged || []).length;
              const name = p.name || 'Unnamed';
              const isSel = p.profileId === selectedId;
              return (
                <button key={p.profileId} role="tab" aria-selected={isSel}
                  id={`tab-${p.profileId}`} aria-controls={`panel-${p.profileId}`}
                  className={`profile-chip ${count > 0 ? 'profile-chip-flagged' : 'profile-chip-safe'} ${isSel ? 'profile-chip-sel' : ''}`}
                  onClick={() => setSelectedId(p.profileId)}>
                  {name} — {count > 0 ? `${count} flagged` : 'safe'}
                </button>
              );
            })}
          </div>
        )}

        {multi ? (
          <div role="tabpanel" id={`panel-${selected.profileId}`} aria-labelledby={`tab-${selected.profileId}`}>
            <ProfileFlags key={selected.profileId} profileId={selected.profileId} flagged={selected.flagged || []} onDismiss={onDismiss} />
          </div>
        ) : (
          <ProfileFlags key={selected.profileId} profileId={selected.profileId} flagged={selected.flagged || []} onDismiss={onDismiss} />
        )}

        {rawText && (
          <section className="results-section results-section-raw">
            <p className="raw-label">Full ingredient text</p>
            <p className="raw-text">{rawText}</p>
          </section>
        )}
        <p className="disclaimer">For informational purposes only. Not a substitute for medical or nutritional advice. Always consult a qualified professional.</p>
      </div>
      <div className="results-footer">
        <button className="ui-btn ui-btn-secondary save-list-btn" onClick={() => setShowSave(true)}>Save to list</button>
        <button className="ui-btn ui-btn-primary scan-again-btn" onClick={onScanAgain}>{onBack ? 'New Scan' : 'Scan Again'}</button>
      </div>
      {showSave && (
        <SaveToListSheet
          product={{ name: productName || 'Scanned product', rawText, imageUrl: imageUrl || null, upc: result.upc || null }}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
