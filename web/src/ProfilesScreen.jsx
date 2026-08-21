import { useNavigate } from 'react-router-dom';
import './ProfilesScreen.css';
import './AllergensScreen.css'; // reuse sheet/input styles
import { useProfileContext } from './useProfiles';

export default function ProfilesScreen({ onBack }) {
  const { profiles, addProfile } = useProfileContext();
  const navigate = useNavigate();

  const multi = profiles.length > 1;

  return (
    <div className="profiles-root">
      <div className="profiles-scroll">
        {profiles.map((p) => {
          const label = p.name || (multi ? 'Unnamed profile' : 'Your profile');
          const needsName = multi && !p.name;
          return (
            <button key={p.id} className="ui-card profile-row" onClick={() => navigate(`/profiles/${p.id}`)}>
              <span className="profile-row-name">{label}</span>
              <span className="profile-row-sub">
                {needsName ? 'Tap to name' : `${(p.activeCategories || []).length} categories flagged`}
              </span>
            </button>
          );
        })}
        <button className="profiles-add" onClick={async () => {
          const id = await addProfile('');
          navigate(`/profiles/${id}`);
        }}>+ Add profile</button>
      </div>
    </div>
  );
}
