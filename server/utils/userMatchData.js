const admin = require('./firebaseAdmin');

function userRef(uid) {
  return admin.firestore().collection('users').doc(uid);
}

async function getPersonalAllergens(uid) {
  const snap = await userRef(uid).collection('allergens').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getDismissedIds(uid) {
  const snap = await userRef(uid).collection('dismissedFlags').get();
  return new Set(snap.docs.map((d) => d.id));
}

async function addDismissedFlag(uid, ingredientId) {
  await userRef(uid)
    .collection('dismissedFlags')
    .doc(ingredientId)
    .set({ ingredientId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

async function getMatchOptions(uid) {
  const [personalAllergens, dismissedIds] = await Promise.all([
    getPersonalAllergens(uid),
    getDismissedIds(uid),
  ]);
  return { personalAllergens, dismissedIds };
}

module.exports = { getPersonalAllergens, getDismissedIds, addDismissedFlag, getMatchOptions };
