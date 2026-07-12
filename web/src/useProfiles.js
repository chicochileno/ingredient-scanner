import { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ensureProfiles } from './migrateProfiles';
import { CATEGORY_KEYS } from './profileCatalog';

export const ProfileContext = createContext({
  profiles: [],
  loading: true,
});

export function useProfileContext() {
  return useContext(ProfileContext);
}

export function useProfiles(user) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfiles([]); setLoading(false); return; }
    let unsub = () => {};
    let cancelled = false;
    ensureProfiles(user.uid)
      .catch((e) => console.error('Profile migration failed:', e))
      .finally(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          query(collection(db, 'users', user.uid, 'profiles'), orderBy('order')),
          (snap) => { setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
          (err) => { console.error('Failed to load profiles:', err); setLoading(false); }
        );
      });
    return () => { cancelled = true; unsub(); };
  }, [user?.uid]);

  async function addProfile(name) {
    await addDoc(collection(db, 'users', user.uid, 'profiles'), {
      name: name?.trim() || null,
      activeCategories: CATEGORY_KEYS,
      order: profiles.length,
      createdAt: serverTimestamp(),
    });
  }
  async function renameProfile(id, name) {
    await updateDoc(doc(db, 'users', user.uid, 'profiles', id), { name: name?.trim() || null });
  }
  async function setActiveCategories(id, categories) {
    await updateDoc(doc(db, 'users', user.uid, 'profiles', id), { activeCategories: categories });
  }
  async function deleteProfile(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'profiles', id));
  }
  async function addAllergen(profileId, { name, type }) {
    await addDoc(collection(db, 'users', user.uid, 'profiles', profileId, 'allergens'), {
      name: name.toLowerCase().trim(), type, createdAt: serverTimestamp(),
    });
  }
  async function removeAllergen(profileId, allergenId) {
    await deleteDoc(doc(db, 'users', user.uid, 'profiles', profileId, 'allergens', allergenId));
  }

  return { profiles, loading, addProfile, renameProfile, setActiveCategories, deleteProfile, addAllergen, removeAllergen };
}
