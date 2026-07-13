import { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
  deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const ListContext = createContext({ lists: [], loading: true });
export function useListContext() { return useContext(ListContext); }

export function useLists(user) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLists([]); setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'lists'), orderBy('order')),
      (snap) => { setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.error('Failed to load lists:', err); setLoading(false); }
    );
    return unsub;
  }, [user?.uid]);

  async function addList(name) {
    const ref = await addDoc(collection(db, 'users', user.uid, 'lists'), {
      name: name?.trim() || 'Untitled list',
      order: lists.length,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  async function renameList(listId, name) {
    await updateDoc(doc(db, 'users', user.uid, 'lists', listId), { name: name?.trim() || 'Untitled list' });
  }
  async function deleteList(listId) {
    await deleteDoc(doc(db, 'users', user.uid, 'lists', listId));
  }
  async function addScannedItem(listId, { name, rawText, imageUrl, upc }) {
    await addDoc(collection(db, 'users', user.uid, 'lists', listId, 'items'), {
      kind: 'scanned',
      name: name || 'Scanned product',
      rawText: rawText || '',
      imageUrl: imageUrl || null,
      upc: upc || null,
      checked: false,
      addedAt: serverTimestamp(),
    });
  }
  async function addManualItem(listId, name) {
    await addDoc(collection(db, 'users', user.uid, 'lists', listId, 'items'), {
      kind: 'manual',
      name: name.trim(),
      checked: false,
      addedAt: serverTimestamp(),
    });
  }
  async function removeItem(listId, itemId) {
    await deleteDoc(doc(db, 'users', user.uid, 'lists', listId, 'items', itemId));
  }
  async function toggleChecked(listId, itemId, checked) {
    await updateDoc(doc(db, 'users', user.uid, 'lists', listId, 'items', itemId), { checked });
  }

  return { lists, loading, addList, renameList, deleteList, addScannedItem, addManualItem, removeItem, toggleChecked };
}
