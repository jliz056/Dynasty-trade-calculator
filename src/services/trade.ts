import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  FieldValue,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface PlayerStats {
  position: string;
  ppg: number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
  targets?: number;
  receptions?: number;
  passing?: {
    yards: number;
    touchdowns: number;
    interceptions: number;
  };
  rushing?: {
    yards: number;
    touchdowns: number;
  };
  receiving?: {
    yards: number;
    touchdowns: number;
    targets?: number;
  };
}

export interface Player {
  name: string;
  value: number;
  stats: PlayerStats;
}

export interface TradeSide {
  players: Player[];
  picks: string[];
}

export interface Trade {
  id?: string;
  userId: string;
  title: string;
  sideA: TradeSide;
  sideB: TradeSide;
  totalValueA: number;
  totalValueB: number;
  createdAt: Date;
  isPublic: boolean;
  league?: {
    name: string;
    scoring?: string;
    format?: string;
    size?: number;
  };
}

// Utility function to safely convert timestamps
const convertTimestamp = (value: any): Date => {
  // Check if it's a Firebase Timestamp
  if (value && typeof value === 'object' && 'toDate' in value) {
    return value.toDate();
  }
  return new Date();
};

// Save a new trade
export const saveTrade = async (trade: Omit<Trade, 'id' | 'userId' | 'createdAt'>): Promise<Trade> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to save a trade');
  }

  try {
    const tradeData = {
      ...trade,
      userId: user.uid,
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'trades'), tradeData);
    return {
      ...tradeData,
      id: docRef.id,
      createdAt: convertTimestamp(tradeData.createdAt)
    };
  } catch (error: any) {
    console.error('Error saving trade:', error);
    throw new Error(error.message || 'Failed to save trade');
  }
};

// Get a specific trade by ID
export const getTrade = async (tradeId: string): Promise<Trade> => {
  try {
    const docRef = doc(db, 'trades', tradeId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt)
      } as Trade;
    } else {
      throw new Error('Trade not found');
    }
  } catch (error: any) {
    console.error('Error getting trade:', error);
    throw new Error(error.message || 'Failed to get trade');
  }
};

// Get all trades for the current user
export const getUserTrades = async (): Promise<Trade[]> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to view your trades');
  }

  try {
    const q = query(
      collection(db, 'trades'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: { id: any; data: () => Trade; }) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertTimestamp(doc.data().createdAt)
    } as Trade));
  } catch (error: any) {
    console.error('Error getting user trades:', error);
    throw new Error(error.message || 'Failed to get trades');
  }
};

// Get public trades for the community
export const getPublicTrades = async (limit = 10): Promise<Trade[]> => {
  try {
    const q = query(
      collection(db, 'trades'), 
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: { id: any; data: () => Trade; }) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertTimestamp(doc.data().createdAt)
    } as Trade)).slice(0, limit);
  } catch (error: any) {
    console.error('Error getting public trades:', error);
    throw new Error(error.message || 'Failed to get public trades');
  }
};

// Update an existing trade
export const updateTrade = async (tradeId: string, tradeData: Partial<Trade>): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to update a trade');
  }

  try {
    // First, verify this trade belongs to the current user
    const tradeRef = doc(db, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    
    if (!tradeSnap.exists()) {
      throw new Error('Trade not found');
    }
    
    if (tradeSnap.data().userId !== user.uid) {
      throw new Error('You can only update your own trades');
    }

    // Remove fields that shouldn't be updated
    const { id, userId, createdAt, ...updatableData } = tradeData as any;
    
    await updateDoc(tradeRef, updatableData);
  } catch (error: any) {
    console.error('Error updating trade:', error);
    throw new Error(error.message || 'Failed to update trade');
  }
};

// Delete a trade
export const deleteTrade = async (tradeId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to delete a trade');
  }

  try {
    // First, verify this trade belongs to the current user
    const tradeRef = doc(db, 'trades', tradeId);
    const tradeSnap = await getDoc(tradeRef);
    
    if (!tradeSnap.exists()) {
      throw new Error('Trade not found');
    }
    
    if (tradeSnap.data().userId !== user.uid) {
      throw new Error('You can only delete your own trades');
    }

    await deleteDoc(tradeRef);
  } catch (error: any) {
    console.error('Error deleting trade:', error);
    throw new Error(error.message || 'Failed to delete trade');
  }
}; 