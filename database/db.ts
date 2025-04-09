// Replace SQLite with Firebase Firestore for Vercel compatibility
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc,
  getFirestore
} from 'firebase/firestore';
import app from '../src/config/firebase';

// Use the existing Firebase db export
import { db } from '../src/config/firebase';

// Player collection reference
const playersCollection = collection(db, 'players');
const playerStatsCollection = collection(db, 'player_stats');

// Create or update a player
export const upsertPlayer = async (playerData: any) => {
  const q = query(playersCollection, where('id', '==', playerData.id));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    // Update existing player
    const docRef = doc(db, 'players', querySnapshot.docs[0].id);
    await updateDoc(docRef, playerData);
    return docRef.id;
  } else {
    // Create new player
    const docRef = await addDoc(playersCollection, playerData);
    return docRef.id;
  }
};

// Create or update player stats
export const upsertPlayerStats = async (statsData: any) => {
  const q = query(playerStatsCollection, where('player_id', '==', statsData.player_id));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    // Update existing stats
    const docRef = doc(db, 'player_stats', querySnapshot.docs[0].id);
    await updateDoc(docRef, statsData);
    return docRef.id;
  } else {
    // Create new stats
    const docRef = await addDoc(playerStatsCollection, statsData);
    return docRef.id;
  }
};

// Get all players
export const getAllPlayers = async () => {
  const querySnapshot = await getDocs(playersCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get player stats
export const getPlayerStatsById = async (playerId: string) => {
  const q = query(playerStatsCollection, where('player_id', '==', playerId));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export default db; 