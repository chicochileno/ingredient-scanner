const admin = require('./firebaseAdmin');

function billingRef(uid) {
  return admin.firestore().collection('users').doc(uid).collection('billing').doc('info');
}

async function getBilling(uid) {
  const snap = await billingRef(uid).get();
  if (!snap.exists) return { scanCount: 0, subscriptionStatus: 'free' };
  return snap.data();
}

async function incrementScanCount(uid) {
  await billingRef(uid).set(
    { scanCount: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );
}

async function updateBilling(uid, fields) {
  await billingRef(uid).set(fields, { merge: true });
}

module.exports = { getBilling, incrementScanCount, updateBilling };
