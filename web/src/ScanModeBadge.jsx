import { scanModeBadge } from './homeModel';

export default function ScanModeBadge({ mode, className = '' }) {
  const badge = scanModeBadge(mode);
  const icon = badge.key === 'barcode'
    ? <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" />
    : badge.key === 'menu'
    ? <path d="M6 3v18M6 8h3M18 3c-2 0-3 2-3 5s1 4 3 4v9" />
    : <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6 9.5 3h5L16 6" /><circle cx="12" cy="13" r="3" /></>;
  return (
    <span className={`scan-mode-badge scan-mode-${badge.key} ${className}`} aria-label={badge.label}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
    </span>
  );
}
