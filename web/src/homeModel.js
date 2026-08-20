// Pure view-model helpers for the Home dashboard. No IO — unit-tested.

const AVATAR_COLORS = ['#2E4B33', '#256B38', '#3F6B4A', '#5A6250', '#8A4B0A', '#6B4A2E'];

// Deterministic avatar: first letter of name (or '?'), color chosen by a stable
// hash of the profile id (falls back to order) so it never changes for a profile.
export function profileAvatar(profile = {}) {
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const initial = name ? name[0].toUpperCase() : '?';
  const key = String(profile.id ?? profile.order ?? '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return { initial, color };
}

// View model for a Home history card. status is 'safe' | 'flagged'.
export function scanCardModel(scan = {}) {
  const modeName =
    scan.mode === 'menu' ? 'Menu scan' : scan.mode === 'barcode' ? 'Barcode scan' : 'Label scan';
  const name = scan.productName || modeName;
  const imageUrl = scan.imageUrl || null;

  let flaggedCount;
  if (scan.mode === 'menu') {
    const profiles = scan.menuSnapshot?.profiles || [];
    flaggedCount = profiles.reduce((n, p) => n + (p.flaggedCount > 0 ? 1 : 0), 0);
  } else {
    flaggedCount = Array.isArray(scan.flagged) ? scan.flagged.length : 0;
  }
  const status = flaggedCount > 0 ? 'flagged' : 'safe';
  const label = status === 'safe' ? 'Safe' : `Flagged (${flaggedCount})`;
  return { name, imageUrl, status, label };
}

// Mode → badge descriptor for scan cards. key selects the icon; label is for a11y.
export function scanModeBadge(mode) {
  if (mode === 'barcode') return { key: 'barcode', label: 'Barcode scan' };
  if (mode === 'menu') return { key: 'menu', label: 'Menu scan' };
  return { key: 'label', label: 'Label scan' };
}
