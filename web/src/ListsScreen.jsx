import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { rematchBatch } from './api';
import './ListsScreen.css';
import './ProfilesScreen.css';
import './AllergensScreen.css';
import { useListContext } from './useLists';
import { useProfileContext } from './useProfiles';
import ShareSheet from './ShareSheet';

export default function ListsScreen({ onBack, onOpen }) {
  const { lists, addList } = useListContext();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function create() {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      const id = await addList(newName.trim());
      setNewName('');
      onOpen(id);
    } catch (e) {
      console.error('Create list failed:', e);
      setAdding(false);
    }
  }

  return (
    <div className="lists-root">
      <div className="lists-scroll">
        {lists.length === 0 && <p className="lists-empty">No lists yet. Create one below, or tap "Save to list" after a scan.</p>}
        {lists.map((l) => (
          <button key={l.id} className="list-row" onClick={() => onOpen(l.id)}>
            <span className="list-row-name">{l.name}</span>
          </button>
        ))}
        <div className="lists-new">
          <label htmlFor="lists-new-name" className="pe-label">New list</label>
          <input id="lists-new-name" className="allergen-input" placeholder="e.g. Road trip snacks"
            value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="lists-new-btn" onClick={create} disabled={!newName.trim() || adding}>
            {adding ? 'Creating…' : '+ New list'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusText(profiles) {
  // profiles: [{ profileId, name, flagged, counts }]
  if (!profiles || profiles.length === 0) return { label: 'Checking…', flagged: false };
  const flaggedProfiles = profiles.filter((p) => (p.flagged || []).length > 0);
  if (flaggedProfiles.length === 0) {
    return { label: profiles.length > 1 ? 'Safe for all' : 'Safe', flagged: false };
  }
  if (profiles.length === 1) return { label: 'Flagged', flagged: true };
  const names = flaggedProfiles.map((p) => p.name || 'Unnamed').join(', ');
  return { label: `Flagged for ${names}`, flagged: true };
}

export function ListDetailScreen({ user, onBack }) {
  const { listId } = useParams();
  const { lists, renameList, deleteList, addManualItem, removeItem, toggleChecked } = useListContext();
  const { profiles } = useProfileContext();
  const list = lists.find((l) => l.id === listId);
  const [items, setItems] = useState([]);
  const [statusById, setStatusById] = useState({}); // itemId -> profiles[]
  const [filter, setFilter] = useState('all'); // all | safe | flags
  const [manualName, setManualName] = useState('');
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'users', user.uid, 'lists', listId, 'items'), orderBy('addedAt')),
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user?.uid, listId]);

  useEffect(() => {
    const scanned = items.filter((it) => it.kind === 'scanned');
    if (scanned.length === 0) { setStatusById({}); return; }
    let cancelled = false;
    rematchBatch(scanned.map((it) => ({ itemId: it.id, rawText: it.rawText || '' })))
      .then(({ results }) => {
        if (cancelled) return;
        const map = {};
        for (const r of results) map[r.itemId] = r.profiles;
        setStatusById(map);
      })
      .catch((e) => console.error('List rematch failed:', e));
    return () => { cancelled = true; };
  }, [items]);

  if (!list) return null;

  const scanned = items.filter((it) => it.kind === 'scanned');
  const manual = items.filter((it) => it.kind === 'manual');
  const visibleScanned = scanned.filter((it) => {
    if (filter === 'all') return true;
    const st = statusText(statusById[it.id]);
    return filter === 'safe' ? !st.flagged : st.flagged;
  });

  return (
    <div className="lists-root">
      <div className="lists-header">
        <input className="ld-name" defaultValue={list.name} maxLength={50}
          onBlur={(e) => renameList(listId, e.target.value)} aria-label="List name" />
      </div>
      <div className="lists-scroll">
        <div className="ld-filter" role="group" aria-label="Filter items">
          {['all', 'safe', 'flags'].map((f) => (
            <button key={f} className={`ld-filter-btn ${filter === f ? 'ld-filter-on' : ''}`}
              aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'safe' ? 'Safe' : 'Has flags'}
            </button>
          ))}
        </div>

        {visibleScanned.map((it) => {
          const st = statusText(statusById[it.id]);
          return (
            <div key={it.id} className="ld-item">
              <input type="checkbox" checked={!!it.checked} aria-label={`Mark ${it.name} bought`}
                onChange={(e) => toggleChecked(listId, it.id, e.target.checked)} />
              {it.imageUrl ? <img className="ld-thumb" src={it.imageUrl} alt="" /> : <span className="ld-thumb ld-thumb-ph">▦</span>}
              <div className="ld-item-body">
                <span className={`ld-item-name ${it.checked ? 'ld-checked' : ''}`}>{it.name}</span>
                <span className={`ld-status ${st.flagged ? 'ld-status-flag' : 'ld-status-safe'}`}>{st.label}</span>
              </div>
              <button className="ld-remove" onClick={() => removeItem(listId, it.id)} aria-label={`Remove ${it.name}`}>×</button>
            </div>
          );
        })}

        {manual.length > 0 && <p className="ld-section">Not scanned</p>}
        {manual.map((it) => (
          <div key={it.id} className="ld-item">
            <input type="checkbox" checked={!!it.checked} aria-label={`Mark ${it.name} bought`}
              onChange={(e) => toggleChecked(listId, it.id, e.target.checked)} />
            <div className="ld-item-body">
              <span className={`ld-item-name ${it.checked ? 'ld-checked' : ''}`}>{it.name}</span>
              <span className="ld-status ld-status-neutral">Not scanned</span>
            </div>
            <button className="ld-remove" onClick={() => removeItem(listId, it.id)} aria-label={`Remove ${it.name}`}>×</button>
          </div>
        ))}

        <div className="ld-add">
          <label htmlFor="ld-manual" className="pe-label">Add an item</label>
          <input id="ld-manual" className="allergen-input" placeholder="e.g. bananas"
            value={manualName} maxLength={60}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manualName.trim()) { addManualItem(listId, manualName); setManualName(''); } }} />
          <button className="lists-new-btn" disabled={!manualName.trim()}
            onClick={() => { addManualItem(listId, manualName); setManualName(''); }}>+ Add item</button>
        </div>

        <button className="ld-delete" onClick={() => { deleteList(listId); onBack(); }}>Delete this list</button>
        <button className="pe-add-allergen" style={{ marginTop: 12 }} onClick={() => setShowShare(true)}>Share list…</button>
      </div>
      {showShare && (
        <ShareSheet type="list" refId={listId} existingShareId={list.shareId || null} profiles={profiles} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
