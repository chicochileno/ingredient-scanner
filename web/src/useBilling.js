import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const BillingContext = createContext({
  scanCount: 0,
  subscriptionStatus: 'free',
  loading: true,
});

export function useBillingContext() {
  return useContext(BillingContext);
}

export function useBilling(user) {
  const [billing, setBilling] = useState({ scanCount: 0, subscriptionStatus: 'free', loading: true });

  useEffect(() => {
    if (!user) {
      setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
      return;
    }
    const ref = doc(db, 'users', user.uid, 'billing', 'info');
    const unsub = onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          setBilling({ ...snap.data(), loading: false });
        } else {
          setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
        }
      },
      err => {
        console.error('Failed to load billing:', err);
        setBilling({ scanCount: 0, subscriptionStatus: 'free', loading: false });
      }
    );
    return unsub;
  }, [user?.uid]);

  return billing;
}
