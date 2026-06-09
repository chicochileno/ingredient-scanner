import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import './HistoryScreen.css';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
}

function FlagBadge({ flagged }) {
  if (!flagged || flagged.length === 0) {
    return <span className="hist-badge hist-badge-safe">Clear</span>;
  }
  const hasHigh = flagged.some(f => f.severity === 'high');
  return (
    <span className={`hist-badge ${hasHigh ? 'hist-badge-danger' : 'hist-badge-warn'}`}>
      {flagged.length} flag{flagged.length !== 1 ? 's' : ''}
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function defaultName(scan) {
  return scan.productName || (scan.mode === 'barcode' ? 'Barcode scan' : 'Label scan');
}

export default function HistoryScreen({ user, onBack, onSelect }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'scans'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        setScans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Failed to load history', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.uid]);

  function startEdit(scan) {
    setEditingId(scan.id);
    setEditingName(defaultName(scan));
  }

  async function saveName(scanId) {
    if (!editingName.trim() || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'scans', scanId), {
        productName: editingName.trim(),
      });
      setScans(prev => prev.map(s => s.id === scanId ? { ...s, productName: editingName.trim() } : s));
      setEditingId(null);
    } catch (e) {
      console.error('Failed to save name', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hist-root">
      <div className="hist-header">
        <button className="hist-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="hist-title">History</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="hist-scroll">
        {loading && (
          <div className="hist-loading">
            <span className="hist-spinner" />
          </div>
        )}

        {!loading && scans.length === 0 && (
          <div className="hist-empty">
            <p className="hist-empty-title">No scans yet</p>
            <p className="hist-empty-sub">Your scan history will appear here.</p>
          </div>
        )}

        {!loading && scans.length > 0 && (
          <ul className="hist-list">
            {scans.map((scan, i) => (
              <li key={scan.id} className="hist-list-item">
                {editingId === scan.id ? (
                  <div className="hist-item hist-item-editing" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="hist-item-thumb">
                      {scan.imageUrl
                        ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                        : <span className="hist-thumb-placeholder">
                            {scan.mode === 'barcode' ? '▦' : '⊟'}
                          </span>
                      }
                    </div>
                    <div className="hist-item-body">
                      <input
                        className="hist-name-input"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveName(scan.id)}
                        autoFocus
                      />
                      <p className="hist-item-date">{formatDate(scan.createdAt)}</p>
                    </div>
                    <div className="hist-edit-actions">
                      <button className="hist-save-btn" onClick={() => saveName(scan.id)} disabled={saving}>
                        {saving ? '…' : 'Save'}
                      </button>
                      <button className="hist-cancel-btn" onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div className="hist-item-row" style={{ animationDelay: `${i * 30}ms` }}>
                    <button className="hist-item" onClick={() => onSelect(scan)}>
                      <div className="hist-item-thumb">
                        {scan.imageUrl
                          ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                          : <span className="hist-thumb-placeholder">
                              {scan.mode === 'barcode' ? '▦' : '⊟'}
                            </span>
                        }
                      </div>
                      <div className="hist-item-body">
                        <p className="hist-item-name">{defaultName(scan)}</p>
                        <p className="hist-item-date">{formatDate(scan.createdAt)}</p>
                      </div>
                      <FlagBadge flagged={scan.flagged} />
                    </button>
                    <button className="hist-edit-btn" onClick={() => startEdit(scan)} aria-label="Edit name">
                      <PencilIcon />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
