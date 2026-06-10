import './ResultsScreen.css';

function SeverityBadge({ severity }) {
  return (
    <span className={`flag-severity flag-severity-${severity}`}>
      {severity === 'high' ? 'High concern' : 'Moderate concern'}
    </span>
  );
}

function IngredientCard({ item, index }) {
  const isHigh = item.severity === 'high';

  return (
    <div
      className={`card ${isHigh ? 'card-high' : 'card-moderate'}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="card-top">
        <div className="card-text">
          <span className="card-flag">{item.flag}</span>
          <span className="card-matched">Found as: {item.matchedOn}</span>
        </div>
        <SeverityBadge severity={item.severity} />
      </div>
      <p className="card-explanation">{item.explanation}</p>
    </div>
  );
}

export default function ResultsScreen({ result, source, onScanAgain, onBack, imageUrl }) {
  const { flagged = [], rawText = '', productName } = result;
  const highCount = flagged.filter(i => i.severity === 'high').length;
  const modCount = flagged.filter(i => i.severity === 'moderate').length;
  const allClear = flagged.length === 0;

  return (
    <div className="results-root">
      <div className="results-scroll">
        {onBack && (
          <button className="results-back" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
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
          <span className="banner-icon">{allClear ? '✓' : '!'}</span>
          <div>
            <p className="banner-title">
              {allClear ? 'No flags found' : `${flagged.length} ingredient${flagged.length !== 1 ? 's' : ''} flagged`}
            </p>
            <p className="banner-sub">
              {allClear
                ? 'No known inflammatory ingredients detected.'
                : [highCount > 0 && `${highCount} high concern`, modCount > 0 && `${modCount} moderate concern`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {flagged.length > 0 && (
          <section className="results-section">
            <h2 className="section-title">Flagged Ingredients</h2>
            <div className="cards">
              {flagged.map((item, i) => (
                <IngredientCard key={item.id} item={item} index={i} />
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
