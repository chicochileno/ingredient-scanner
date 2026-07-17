import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './SharePage.css';

const API = import.meta.env.VITE_API_URL || '';

function statusLabel(status) {
  if (status === 'safe') return { text: '✓ Safe', cls: 'sp-safe' };
  if (status === 'flagged') return { text: '⚠ Contains flagged ingredients', cls: 'sp-flag' };
  return { text: 'Not scanned', cls: 'sp-neutral' };
}

export default function SharePage() {
  const { shareId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: false });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/share/${shareId}`)
      .then(async (r) => { if (!r.ok) throw new Error('unavailable'); return r.json(); })
      .then((data) => { if (!cancelled) setState({ loading: false, data, error: false }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null, error: true }); });
    return () => { cancelled = true; };
  }, [shareId]);

  if (state.loading) return <div className="sp-root"><div className="sp-card"><p className="sp-muted">Loading…</p></div></div>;
  if (state.error || !state.data) {
    return <div className="sp-root"><div className="sp-card">
      <h1 className="sp-title">Link unavailable</h1>
      <p className="sp-muted">This shared link is no longer available. Ask the person who sent it for a new one.</p>
    </div></div>;
  }

  const d = state.data;
  return (
    <div className="sp-root">
      <div className="sp-card">
        <p className="sp-brand">Ingredient Scanner</p>
        {d.type === 'profile' ? (
          <>
            <h1 className="sp-title">{d.title}</h1>
            <p className="sp-lede">Please avoid the following for this child:</p>
            {d.avoid.length === 0
              ? <p className="sp-muted">No specific items listed.</p>
              : <ul className="sp-avoid">{d.avoid.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          </>
        ) : (
          <>
            <h1 className="sp-title">Safe snacks{d.childName ? ` for ${d.childName}` : ''}</h1>
            <p className="sp-lede">{d.title}</p>
            <ul className="sp-items">
              {d.items.map((it, i) => {
                const s = statusLabel(it.status);
                return <li key={i} className="sp-item"><span className="sp-item-name">{it.name}</span><span className={`sp-status ${s.cls}`}>{s.text}</span></li>;
              })}
            </ul>
          </>
        )}
        <p className="sp-disclaimer">For informational purposes only. Not a substitute for medical or nutritional advice.</p>
        <button className="sp-print" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </div>
  );
}
