const admin = require('./firebaseAdmin');
const { matchIngredients } = require('./ingredientMatcher');

function userRef(uid) {
  return admin.firestore().collection('users').doc(uid);
}
function profileRef(uid, profileId) {
  return userRef(uid).collection('profiles').doc(profileId);
}

// Ordered list of profiles: { id, name, activeCategories, order }
async function getProfiles(uid) {
  const snap = await userRef(uid).collection('profiles').orderBy('order').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// A profile's allergens + dismissed ids (categories come from the profile doc)
async function getProfileFlagInputs(uid, profileId) {
  const [allergensSnap, dismissedSnap] = await Promise.all([
    profileRef(uid, profileId).collection('allergens').get(),
    profileRef(uid, profileId).collection('dismissedFlags').get(),
  ]);
  return {
    personalAllergens: allergensSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    dismissedIds: new Set(dismissedSnap.docs.map((d) => d.id)),
  };
}

function countByTier(flagged) {
  return {
    high: flagged.filter((f) => f.tier !== 'possible' && f.severity === 'high').length,
    moderate: flagged.filter((f) => f.tier !== 'possible' && f.severity === 'moderate').length,
    possible: flagged.filter((f) => f.tier === 'possible').length,
  };
}

// Match rawText against every profile. Returns [{ profileId, name, flagged, counts }]
async function matchAllProfiles(uid, rawText) {
  const profiles = await getProfiles(uid);
  return Promise.all(
    profiles.map(async (p) => {
      const inputs = await getProfileFlagInputs(uid, p.id);
      const flagged = matchIngredients(rawText, {
        activeCategories: p.activeCategories || [],
        ...inputs,
      });
      return { profileId: p.id, name: p.name != null ? p.name : null, flagged, counts: countByTier(flagged) };
    })
  );
}

async function addDismissedFlag(uid, profileId, ingredientId) {
  await profileRef(uid, profileId)
    .collection('dismissedFlags')
    .doc(ingredientId)
    .set({ ingredientId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

module.exports = { getProfiles, matchAllProfiles, addDismissedFlag };
