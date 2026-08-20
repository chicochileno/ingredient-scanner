import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Live newest-first recent scans for the Home dashboard grid.
export function useRecentScans(user, max = 8) {
  const [state, setState] = useState({ scans: [], loading: true });

  useEffect(() => {
    if (!user) {
      setState({ scans: [], loading: false });
      return;
    }
    const q = query(
      collection(db, 'users', user.uid, 'scans'),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setState({ scans: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('Failed to load recent scans:', err);
        setState({ scans: [], loading: false });
      }
    );
    return unsub;
  }, [user?.uid, max]);

  return state;
}
