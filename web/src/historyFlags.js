// Pure helpers for per-person flag display on History cards. No IO.

export function perProfileFromRematch(profilesArr = []) {
  return profilesArr.map((p) => ({
    name: p.name != null && p.name !== '' ? p.name : 'Unnamed',
    count: Array.isArray(p.flagged) ? p.flagged.length : 0,
  }));
}

export function perProfileFromMenu(menuProfilesArr = []) {
  return menuProfilesArr.map((p) => ({
    name: p.name != null && p.name !== '' ? p.name : 'Unnamed',
    count: p.flaggedCount || 0,
  }));
}

// Solo family → one Safe/Flagged pill. Multi → one "{name} {count}" pill per profile.
export function statusPills(perProfile = []) {
  if (perProfile.length <= 1) {
    const count = perProfile[0]?.count || 0;
    return [{ label: count > 0 ? `Flagged (${count})` : 'Safe', variant: count > 0 ? 'danger' : 'safe' }];
  }
  return perProfile.map((p) => ({ label: `${p.name} ${p.count}`, variant: p.count > 0 ? 'danger' : 'safe' }));
}
