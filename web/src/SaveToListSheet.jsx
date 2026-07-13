import { useState } from 'react';
import { useListContext } from './useLists';

// product: { name, rawText, imageUrl, upc }
export default function SaveToListSheet({ product, onClose }) {
  const { lists, addList, addScannedItem } = useListContext();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState(null);

  async function saveTo(listId, listName) {
    if (busy) return;
    setBusy(true);
    try {
      await addScannedItem(listId, product);
      setSavedTo(listName);
      setTimeout(onClose, 900);
    } catch (e) {
      console.error('Save to list failed:', e);
      setBusy(false);
    }
  }
  async function createAndSave() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addList(newName.trim());
      await addScannedItem(id, product);
      setSavedTo(newName.trim());
      setTimeout(onClose, 900);
    } catch (e) {
      console.error('Create+save failed:', e);
      setBusy(false);
    }
  }

  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Save to list">
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Save to list</h2>
        {savedTo ? (
          <p className="stl-saved">Saved to "{savedTo}" ✓</p>
        ) : (
          <>
            {lists.length > 0 && (
              <div className="stl-lists">
                {lists.map((l) => (
                  <button key={l.id} className="stl-list-btn" disabled={busy} onClick={() => saveTo(l.id, l.name)}>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="stl-new" className="pe-label">New list</label>
            <input id="stl-new" className="allergen-input" placeholder="e.g. School snacks"
              value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} />
            <button className="allergen-save-btn" onClick={createAndSave} disabled={!newName.trim() || busy}>
              {busy ? 'Saving…' : 'Create & save'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
