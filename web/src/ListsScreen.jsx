import { useState } from 'react';
import './ListsScreen.css';
import './ProfilesScreen.css';
import './AllergensScreen.css';
import { useListContext } from './useLists';

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
      <div className="lists-header">
        <button className="lists-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="lists-title">Lists</h1>
      </div>
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
