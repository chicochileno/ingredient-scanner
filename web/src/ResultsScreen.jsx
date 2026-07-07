import { useState } from 'react';
import './ResultsScreen.css';
import { dismissFlag } from './api';

function SeverityBadge({ tier, severity }) {
  if (tier === 'possible') {
    return <span className="flag-severity flag-severity-possible">Worth checking</span>;
  }
  return (
    <span className={`flag-severity flag-severity-${severity}`}>
      {severity === 'high' ? 'High concern' : 'Moderate concern'}
    </span>
  );
}

function Sources({ citations }) {
  const [open, setOpen] = useState(false);
  if (!citations || citations.length === 0) return null;
  return (
    <div className="card-sources">
      <button className="card-sources-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide sources' : 'Sources'}
      </button>
      {open && (
        <ul className="card-sources-list">
          {citations.map((c, i) => (
            <li key={i}>
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
    <div className={`card ${cardClass}`} style={{ animationDelay: `${index * 60}ms` }}>
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

export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { flagged = [], rawText = '', productName } = result;
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  async function handleDismiss(id) {
    setDismissedIds((prev) => new Set(prev).add(id)); // optimistic hide
    try {
      await dismissFlag(id);
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  }

  // Backward-compat: old stored scans lack tier/source
  const visible = flagged
    .filter((f) => !dismissedIds.has(f.id))
    .map((f) => ({ ...f, tier: f.tier || 'confident', source: f.source || 'curated' }));

  const personal = visible.filter((f) => f.source === 'personal' && f.tier !== 'possible');
  const curated = visible.filter((f) => f.source === 'curated' && f.tier !== 'possible');
  const possible = visible.filter((f) => f.tier === 'possible');

  const highCount = visible.filter((i) => i.severity === 'high' && i.tier !== 'possible').length;
  const modCount = visible.filter((i) => i.severity === 'moderate' && i.tier !== 'possible').length;
  const allClear = visible.length === 0;

  let cardIndex = 0;

  return (
    <div className="results-root">
      <div className="results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        )}

        {imageUrl && (
          <div className="results-photo-wrap">
            <img src={imageUrl} alt="Scanned item" className="results-photo" />
          </div>
        )}

        <div className="results-header">
          {productName && <h1 className="results-product">{productName}</h1>}
          <p className="results-source">
            {source === 'barcode' ? 'Scanned via barcode' : 'Scanned via camera'}
          </p>
        </div>

        <div className={`banner ${allClear ? 'banner-safe' : highCount > 0 ? 'banner-danger' : 'banner-warning'}`}>
          <span className="banner-icon">{allClear ? '✓' : highCount > 0 ? '!' : '~'}</span>
          <div>
            <p className="banner-title">
              {allClear ? 'No flags found' : `${visible.length} ingredient${visible.length !== 1 ? 's' : ''} flagged`}
            </p>
            <p className="banner-sub">
              {allClear
                ? 'No known inflammatory ingredients detected.'
                : [highCount > 0 && `${highCount} high concern`, modCount > 0 && `${modCount} moderate concern`, possible.length > 0 && `${possible.length} worth checking`]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
        </div>

        {personal.length > 0 && (
          <section className="results-section">
            <h2 className="section-title section-title-allergen">Personal Allergens</h2>
            <div className="cards">
              {personal.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        {curated.length > 0 && (
          <section className="results-section">
            <h2 className="section-title">Flagged Ingredients</h2>
            <div className="cards">
              {curated.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        {possible.length > 0 && (
          <section className="results-section">
            <h2 className="section-title section-title-possible">Worth Checking</h2>
            <div className="cards">
              {possible.map((item) => (
                <IngredientCard key={item.id} item={item} index={cardIndex++} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        {rawText && (
          <section className="results-section results-section-raw">
            <p className="raw-label">Full ingredient text</p>
            <p className="raw-text">{rawText}</p>
          </section>
        )}

        <p className="disclaimer">
          For informational purposes only. Not a substitute for medical or nutritional advice.
          Always consult a qualified professional.
        </p>
      </div>

      <div className="results-footer">
        <button className="scan-again-btn" onClick={onScanAgain}>
          {onBack ? 'New Scan' : 'Scan Again'}
        </button>
      </div>
    </div>
  );
}
