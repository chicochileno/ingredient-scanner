import { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const AllergenContext = createContext({
  allergens: [],
  loading: true,
  addAllergen: async () => {},
  removeAllergen: async () => {},
});

export function useAllergenContext() {
  return useContext(AllergenContext);
}

export function useAllergens(user) {
  const [allergens, setAllergens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAllergens([]);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'allergens'),
      snap => {
        setAllergens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  async function addAllergen({ name, type }) {
    await addDoc(collection(db, 'users', user.uid, 'allergens'), {
      name: name.toLowerCase().trim(),
      type,
      createdAt: serverTimestamp(),
    });
  }

  async function removeAllergen(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'allergens', id));
  }

  return { allergens, loading, addAllergen, removeAllergen };
}
