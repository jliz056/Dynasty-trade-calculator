import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../src/config/firebase';

// Sleeper API URL
const SLEEPER_API_URL = 'https://api.sleeper.app/v1';

// Function to fetch players from Sleeper API
const fetchSleeperPlayers = async () => {
  try {
    const response = await axios.get(`${SLEEPER_API_URL}/players/nfl`);
    return response.data;
  } catch (error) {
    console.error('Error fetching players from Sleeper:', error);
    throw error;
  }
};

// Handler function for the API endpoint
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('Starting NFL stats sync...');
    
    // Fetch player data from Sleeper
    const sleeperPlayers = await fetchSleeperPlayers();
    console.log(`Fetched ${Object.keys(sleeperPlayers).length} players from Sleeper API`);
    
    // Convert object to array and process players
    const playersArray = Object.values(sleeperPlayers);
    const playerBatch = playersArray.slice(0, 100); // Process 100 players at a time to avoid timeouts
    
    // Counter for tracking changes
    let created = 0;
    let updated = 0;
    
    // Process each player
    for (const player of playerBatch) {
      if (!player.position || !player.full_name) continue; // Skip players with missing data
      
      // Check if player already exists
      const playersRef = collection(db, 'players');
      const q = query(playersRef, where('player_id', '==', player.player_id));
      const querySnapshot = await getDocs(q);
      
      const playerData = {
        player_id: player.player_id,
        name: player.full_name || `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: player.team || 'FA',
        age: player.age || 0,
        experience: player.years_exp || 0,
        value: player.fantasy_positions?.includes('QB') ? 80 : 
               player.position === 'RB' ? 70 : 
               player.position === 'WR' ? 65 : 
               player.position === 'TE' ? 60 : 50,
        updated_at: new Date()
      };
      
      if (querySnapshot.empty) {
        // Create new player document
        await addDoc(playersRef, playerData);
        created++;
      } else {
        // Update existing player document
        const playerDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'players', playerDoc.id), playerData);
        updated++;
      }
    }
    
    console.log(`Sync complete. Created: ${created}, Updated: ${updated}`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `NFL stats synced successfully. Created: ${created}, Updated: ${updated}`
    });
  } catch (error) {
    console.error('Error syncing NFL stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error syncing NFL stats',
      error: error.message
    });
  }
} 