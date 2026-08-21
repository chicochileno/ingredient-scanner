import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useProfileContext } from './useProfiles';
import { CATEGORIES, PRESETS } from './profileCatalog';
import ShareSheet from './ShareSheet';

function AllergenAddSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('allergy');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), type }); }
    catch (e) { console.error(e); setSaving(false); }
  }
  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add ingredient">
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Add ingredient</h2>
        <label htmlFor="allergen-name" className="pe-label">Ingredient name</label>
        <input id="allergen-name" className="allergen-input" placeholder="e.g. onion" value={name}
          onChange={(e) => setName(e.target.value)} maxLength={50} autoFocus />
        <div className="allergen-type-row" role="group" aria-label="Concern level">
          <button type="button" aria-pressed={type === 'allergy'}
            className={`allergen-type-btn ${type === 'allergy' ? 'allergen-type-btn-active-high' : ''}`}
            onClick={() => setType('allergy')}>Allergy</button>
          <button type="button" aria-pressed={type === 'sensitivity'}
            className={`allergen-type-btn ${type === 'sensitivity' ? 'allergen-type-btn-active-mod' : ''}`}
            onClick={() => setType('sensitivity')}>Sensitivity</button>
        </div>
        <button className="allergen-save-btn" onClick={save} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export default function ProfileEditor({ profile, onClose }) {
  const { renameProfile, setActiveCategories, addAllergen, removeAllergen, deleteProfile, profiles } = useProfileContext();
  const active = new Set(profile.activeCategories || []);
  const [allergens, setAllergens] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'profiles', profile.id, 'allergens'),
      (snap) => setAllergens(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [profile.id]);

  function applyPreset(preset) { setActiveCategories(profile.id, preset.categories); }
  function toggleCategory(key) {
    const next = new Set(active);
    next.has(key) ? next.delete(key) : next.add(key);
    setActiveCategories(profile.id, [...next]);
  }

  return (
    <div className="pe-root">
      <div className="pe-scroll">
        <label htmlFor="pe-name" className="pe-label">Profile name</label>
        <input id="pe-name" className="ui-input" placeholder="e.g. Emma (optional)"
          defaultValue={profile.name || ''} maxLength={40}
          onBlur={(e) => renameProfile(profile.id, e.target.value)} />

        <p className="pe-section-label">Quick presets</p>
        <div className="pe-presets">
          {PRESETS.map((p) => (
            <button key={p.key} className="ui-pill ui-pill-neutral pe-preset" onClick={() => applyPreset(p)}
              aria-label={`Apply ${p.label} preset — ${p.description}`}>{p.label}</button>
          ))}
        </div>

        <p className="pe-section-label">Flag these categories</p>
        <div className="pe-switches">
          {CATEGORIES.map((c) => {
            const on = active.has(c.key);
            return (
              <button key={c.key} role="switch" aria-checked={on}
                className={`pe-switch ${on ? 'pe-switch-on' : ''}`} onClick={() => toggleCategory(c.key)}>
                <span className="pe-switch-label">{c.label}</span>
                <span className="pe-switch-state">{on ? 'On' : 'Off'}</span>
              </button>
            );
          })}
        </div>

        <p className="pe-section-label">Custom allergens</p>
        {allergens.length === 0 && <p className="pe-empty">None added.</p>}
        {allergens.map((a) => (
          <div key={a.id} className="pe-allergen-row">
            <span>{a.name} <span className="pe-allergen-type">{a.type === 'allergy' ? 'Allergy' : 'Sensitivity'}</span></span>
            <button className="pe-allergen-remove" onClick={() => removeAllergen(profile.id, a.id)}
              aria-label={`Remove ${a.name}`}>×</button>
          </div>
        ))}
        <button className="pe-add-allergen" onClick={() => setShowAdd(true)}>+ Add allergen</button>
        <button className="pe-add-allergen" onClick={() => setShowShare(true)}>Share profile…</button>

        {profiles.length > 1 && (
          <button className="ui-btn pe-delete" onClick={() => { deleteProfile(profile.id); onClose(); }}>
            Delete this profile
          </button>
        )}
      </div>
      {showAdd && (
        <AllergenAddSheet onClose={() => setShowAdd(false)}
          onSave={async (item) => { await addAllergen(profile.id, item); setShowAdd(false); }} />
      )}
      {showShare && (
        <ShareSheet type="profile" refId={profile.id} existingShareId={profile.shareId || null} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
