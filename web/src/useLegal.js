import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { isLegalLoading } from './legal';

// Live-loads the user's terms-acceptance record from users/{uid}/legal/acceptance.
// Returns { acceptance, loading }. Fails toward showing the gate (acceptance:null)
// on error, never toward silently skipping it.
//
// `loading` is DERIVED from which uid the record in hand belongs to, not stored as
// a flag. A stored flag goes stale: the signed-out branch would set loading:false,
// and the render right after `user` appeared would then see loading:false with a
// null acceptance and flash the terms gate until the first snapshot arrived.
export function useLegal(user) {
  const [state, setState] = useState({ acceptance: null, loadedUid: null });

  useEffect(() => {
    // Nothing to subscribe to when signed out. There is deliberately no setState
    // here: the return value below derives both fields from `user`, so the
    // signed-out case needs no stored state to be correct.
    if (!user) return;
    const uid = user.uid;
    const ref = doc(db, 'users', uid, 'legal', 'acceptance');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ acceptance: snap.exists() ? snap.data() : null, loadedUid: uid }),
      (err) => {
        console.error('Failed to load legal acceptance:', err);
        // Mark it loaded so the gate shows rather than spinning forever.
        setState({ acceptance: null, loadedUid: uid });
      }
    );
    return unsub;
  }, [user?.uid]);

  return {
    // Never hand back a record belonging to a previous session's user.
    acceptance: user ? state.acceptance : null,
    loading: isLegalLoading(user?.uid, state.loadedUid),
  };
}
