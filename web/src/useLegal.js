import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Live-loads the user's terms-acceptance record from users/{uid}/legal/acceptance.
// Returns { acceptance, loading }. Fails toward showing the gate (acceptance:null)
// on error, never toward silently skipping it.
export function useLegal(user) {
  const [state, setState] = useState({ acceptance: null, loading: true });

  useEffect(() => {
    if (!user) {
      setState({ acceptance: null, loading: false });
      return;
    }
    const ref = doc(db, 'users', user.uid, 'legal', 'acceptance');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ acceptance: snap.exists() ? snap.data() : null, loading: false }),
      (err) => {
        console.error('Failed to load legal acceptance:', err);
        setState({ acceptance: null, loading: false });
      }
    );
    return unsub;
  }, [user?.uid]);

  return state;
}
