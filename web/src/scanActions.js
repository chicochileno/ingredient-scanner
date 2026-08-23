import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

// Rename a saved scan (updates productName).
export async function renameScan(uid, scanId, name) {
  await updateDoc(doc(db, 'users', uid, 'scans', scanId), { productName: name.trim() });
}

// Delete a saved scan doc + best-effort its stored camera image.
export async function deleteScan(uid, scan) {
  await deleteDoc(doc(db, 'users', uid, 'scans', scan.id));
  if (scan.imageUrl) {
    await deleteObject(ref(storage, `scans/${uid}/${scan.id}.jpg`)).catch(() => {});
  }
}
