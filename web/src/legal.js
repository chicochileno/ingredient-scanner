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

// True while we don't yet hold THIS user's acceptance record. `loadedUid` is the
// uid the acceptance state in hand came from; anything else — including the null
// left by the signed-out branch — means it belongs to someone else and must not
// be trusted. Deriving loading this way (rather than storing a flag an effect
// flips) is what stops the terms gate flashing during the window between the
// user appearing and the first Firestore snapshot arriving. Pure — no imports.
export function isLegalLoading(uid, loadedUid) {
  if (!uid) return false;
  return loadedUid !== uid;
}
