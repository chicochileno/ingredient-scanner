import { useState } from 'react';
import './ProfilesScreen.css';
import './AllergensScreen.css'; // reuse sheet/input styles
import { useProfileContext } from './useProfiles';
import ProfileEditor from './ProfileEditor';

export default function ProfilesScreen({ onBack }) {
  const { profiles, addProfile } = useProfileContext();
  const [editingId, setEditingId] = useState(null);
  const editing = profiles.find((p) => p.id === editingId);

  if (editing) return <ProfileEditor profile={editing} onClose={() => setEditingId(null)} />;

  const multi = profiles.length > 1;

  return (
    <div className="profiles-root">
      <div className="profiles-header">
        <button className="profiles-back" onClick={onBack} aria-label="Back to home">‹ Back</button>
        <h1 className="profiles-title">Profiles</h1>
      </div>
      <div className="profiles-scroll">
        {profiles.map((p) => {
          const label = p.name || (multi ? 'Unnamed profile' : 'Your profile');
          const needsName = multi && !p.name;
          return (
            <button key={p.id} className="profile-row" onClick={() => setEditingId(p.id)}>
              <span className="profile-row-name">{label}</span>
              <span className="profile-row-sub">
                {needsName ? 'Tap to name' : `${(p.activeCategories || []).length} categories flagged`}
              </span>
            </button>
          );
        })}
        <button className="profiles-add" onClick={async () => {
          await addProfile('');
        }}>+ Add profile</button>
      </div>
    </div>
  );
}
