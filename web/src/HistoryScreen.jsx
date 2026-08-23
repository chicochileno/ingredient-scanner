import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db } from './firebase';
import './HistoryScreen.css';
import SaveToListSheet from './SaveToListSheet';
import './AllergensScreen.css';
import { scanCardModel } from './homeModel';
import ScanModeBadge from './ScanModeBadge';
import { renameScan, deleteScan as deleteScanDoc } from './scanActions';

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

function StatusPill({ scan }) {
  const { status, label } = scanCardModel(scan);
  return <span className={`ui-pill ui-pill-${status === 'safe' ? 'safe' : 'danger'}`}>{label}</span>;
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saveScan, setSaveScan] = useState(null);

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
      await renameScan(user.uid, scanId, editingName);
      setScans(prev => prev.map(s => s.id === scanId ? { ...s, productName: editingName.trim() } : s));
      setEditingId(null);
    } catch (e) {
      console.error('Failed to save name', e);
    } finally {
      setSaving(false);
    }
  }

  async function deleteScan(scan) {
    try {
      await deleteScanDoc(user.uid, scan);
      setScans(prev => prev.filter(s => s.id !== scan.id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error('Failed to delete scan', e);
    }
  }

  return (
    <div className="hist-root">
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
                  <div className="ui-card hist-item-editing" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="hist-item-thumb">
                      {scan.imageUrl
                        ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                        : <span className="hist-thumb-placeholder">{scan.mode === 'barcode' ? '||I|I||' : scan.mode === 'menu' ? '≣' : '⊟'}</span>}
                      <ScanModeBadge mode={scan.mode} className="hist-mode-badge" />
                    </div>
                    <div className="hist-item-body">
                      <input
                        className="ui-input hist-name-input"
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
                  <div className="ui-card hist-item-row" style={{ animationDelay: `${i * 30}ms` }}>
                    <button className="hist-item" onClick={() => onSelect(scan)}>
                      <div className="hist-item-thumb">
                        {scan.imageUrl
                          ? <img src={scan.imageUrl} alt="" className="hist-thumb-img" />
                          : <span className="hist-thumb-placeholder">{scan.mode === 'barcode' ? '||I|I||' : scan.mode === 'menu' ? '≣' : '⊟'}</span>}
                        <ScanModeBadge mode={scan.mode} className="hist-mode-badge" />
                      </div>
                      <div className="hist-item-body">
                        {confirmDeleteId === scan.id ? (
                          <p className="hist-item-name hist-delete-confirm-text">Delete this scan?</p>
                        ) : (
                          <p className="hist-item-name">{defaultName(scan)}</p>
                        )}
                        <p className="hist-item-date">{formatDate(scan.createdAt)}</p>
                      </div>
                      {confirmDeleteId !== scan.id && <StatusPill scan={scan} />}
                    </button>
                    {confirmDeleteId === scan.id ? (
                      <div className="hist-delete-actions">
                        <button className="hist-delete-confirm-btn" onClick={() => deleteScan(scan)}>Delete</button>
                        <button className="hist-cancel-btn" onClick={() => setConfirmDeleteId(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="hist-row-actions">
                        <button className="hist-edit-btn" onClick={() => setSaveScan(scan)} aria-label="Save to list">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
                        </button>
                        <button className="hist-edit-btn" onClick={() => startEdit(scan)} aria-label="Edit name">
                          <PencilIcon />
                        </button>
                        <button className="hist-delete-btn" onClick={() => setConfirmDeleteId(scan.id)} aria-label="Delete scan">
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {saveScan && (
        <SaveToListSheet
          product={{ name: saveScan.productName || defaultName(saveScan), rawText: saveScan.rawText || '', imageUrl: saveScan.imageUrl || null, upc: saveScan.upc || null }}
          onClose={() => setSaveScan(null)}
        />
      )}
    </div>
  );
}
