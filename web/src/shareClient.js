import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

// 18 random bytes -> 24-char URL-safe token
function genToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function shareUrl(shareId) {
  return `${window.location.origin}/s/${shareId}`;
}

// type: 'profile' | 'list'; profileId only for lists
export async function createShare(type, refId, profileId = null) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const shareId = genToken();
  await setDoc(doc(db, 'shares', shareId), {
    ownerUid: uid,
    type,
    refId,
    profileId: profileId || null,
    revoked: false,
    createdAt: serverTimestamp(),
  });
  const parent = type === 'profile'
    ? doc(db, 'users', uid, 'profiles', refId)
    : doc(db, 'users', uid, 'lists', refId);
  await updateDoc(parent, { shareId });
  return shareId;
}

export async function revokeShare(type, refId, shareId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  await updateDoc(doc(db, 'shares', shareId), { revoked: true });
  const parent = type === 'profile'
    ? doc(db, 'users', uid, 'profiles', refId)
    : doc(db, 'users', uid, 'lists', refId);
  await updateDoc(parent, { shareId: null });
}
