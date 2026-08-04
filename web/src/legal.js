// Single source of truth for the accepted-terms version. Bump this (integer)
// whenever the Terms of Service or Privacy Policy materially change — every
// user will then be re-prompted to accept once.
export const CURRENT_TERMS_VERSION = 1;

// True when the user must (re)accept: no acceptance record, no numeric version,
// or a version older than the current one. Pure — no imports, unit-tested.
export function needsTermsAcceptance(acceptance, currentVersion) {
  if (!acceptance || typeof acceptance.acceptedVersion !== 'number') return true;
  return acceptance.acceptedVersion < currentVersion;
}
