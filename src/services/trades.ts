import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SavedTrade } from '../types';

const TRADES = 'trades';

export async function saveTrade(trade: Omit<SavedTrade, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, TRADES), trade);
  return ref.id;
}

export async function getUserTrades(userId: string): Promise<SavedTrade[]> {
  const q = query(collection(db, TRADES), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const trades = snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as SavedTrade,
  );
  return trades.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTrade(tradeId: string): Promise<void> {
  await deleteDoc(doc(db, TRADES, tradeId));
}
