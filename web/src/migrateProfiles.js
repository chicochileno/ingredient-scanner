import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CATEGORY_KEYS } from './profileCatalog';

// If the user has no profiles yet, create one invisible default profile
// (all categories on) and copy any existing top-level allergens/dismissedFlags
// into it. Idempotent: does nothing once a profile exists. Returns true if it created one.
export async function ensureProfiles(uid) {
  const profilesSnap = await getDocs(collection(db, 'users', uid, 'profiles'));
  if (!profilesSnap.empty) return false;

  const batch = writeBatch(db);
  const defaultRef = doc(db, 'users', uid, 'profiles', 'default');
  batch.set(defaultRef, {
    name: null,
    activeCategories: CATEGORY_KEYS,
    order: 0,
    createdAt: serverTimestamp(),
  });

  const allergensSnap = await getDocs(collection(db, 'users', uid, 'allergens'));
  allergensSnap.forEach((d) => {
    batch.set(doc(db, 'users', uid, 'profiles', 'default', 'allergens', d.id), d.data());
  });

  const dismissedSnap = await getDocs(collection(db, 'users', uid, 'dismissedFlags'));
  dismissedSnap.forEach((d) => {
    batch.set(doc(db, 'users', uid, 'profiles', 'default', 'dismissedFlags', d.id), d.data());
  });

  await batch.commit();
  return true;
}
