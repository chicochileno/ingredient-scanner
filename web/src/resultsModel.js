// Pure: map a flag to a status-pill descriptor. No IO.
export function severityPill(flag = {}) {
  if (flag.tier === 'possible') return { variant: 'warning', label: 'Worth checking' };
  if (flag.severity === 'high') return { variant: 'danger', label: 'High concern' };
  if (flag.severity === 'moderate') return { variant: 'warning', label: 'Moderate concern' };
  return { variant: 'neutral', label: 'Flagged' };
}
