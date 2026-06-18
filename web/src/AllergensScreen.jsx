import { useState, useEffect, useRef } from 'react';
import { useAllergenContext } from './useAllergens';
import './AllergensScreen.css';

function AllergenRow({ allergen, onRemove }) {
  const isAllergy = allergen.type === 'allergy';
  return (
    <div className={`allergen-row ${isAllergy ? 'allergen-row-high' : 'allergen-row-mod'}`}>
      <div className="allergen-row-info">
        <span className="allergen-row-name">{allergen.name}</span>
        <span className={`allergen-row-type ${isAllergy ? 'allergen-type-high' : 'allergen-type-mod'}`}>
          {isAllergy ? 'Allergy · High concern' : 'Sensitivity · Moderate concern'}
        </span>
      </div>
      <button className="allergen-row-remove" onClick={onRemove} aria-label={`Remove ${allergen.name}`}>
        ×
      </button>
    </div>
  );
}

function AddSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('allergy');
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function adjust() {
      if (!sheetRef.current) return;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      sheetRef.current.style.transform = `translateY(-${offset}px)`;
    }
    vv.addEventListener('resize', adjust);
    vv.addEventListener('scroll', adjust);
    return () => {
      vv.removeEventListener('resize', adjust);
      vv.removeEventListener('scroll', adjust);
    };
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type });
    } catch (err) {
      console.error('Failed to save allergen:', err);
      setSaving(false);
    }
  }

  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Add ingredient</h2>
        <input
          className="allergen-input"
          placeholder="e.g. onion, gluten, soy..."
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
        />
        <div className="allergen-type-row">
          <button
            className={`allergen-type-btn ${type === 'allergy' ? 'allergen-type-btn-active-high' : ''}`}
            onClick={() => setType('allergy')}
          >
            Allergy
          </button>
          <button
            className={`allergen-type-btn ${type === 'sensitivity' ? 'allergen-type-btn-active-mod' : ''}`}
            onClick={() => setType('sensitivity')}
          >
            Sensitivity
          </button>
        </div>
        <p className="allergen-type-hint">
          {type === 'allergy' ? 'Flagged as high concern.' : 'Flagged as moderate concern.'}
        </p>
        <button
          className="allergen-save-btn"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export default function AllergensScreen({ onBack }) {
  const { allergens, addAllergen, removeAllergen } = useAllergenContext();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="allergens-root">
      <div className="allergens-header">
        <button className="allergens-back" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="allergens-title">My Allergens</h1>
      </div>

      <div className="allergens-scroll">
        <p className="allergens-hint">
          Exact names only — "onion" won't match "onion powder".
        </p>
        {allergens.length === 0 ? (
          <p className="allergens-empty">No allergens added yet. Tap + to add your first.</p>
        ) : (
          allergens.map(a => (
            <AllergenRow
              key={a.id}
              allergen={a}
              onRemove={() => removeAllergen(a.id)}
            />
          ))
        )}
      </div>

      <button className="allergens-fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddSheet
          onSave={async (item) => { await addAllergen(item); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
