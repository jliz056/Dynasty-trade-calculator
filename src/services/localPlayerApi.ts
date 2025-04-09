import axios from 'axios';
import type { PlayerData } from './player';

// Use environment variable for API URL or fall back to default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const SLEEPER_API_URL = import.meta.env.VITE_SLEEPER_API_URL || 'https://api.sleeper.app/v1';

console.log('API BASE URL:', API_BASE_URL);
console.log('SLEEPER API URL:', SLEEPER_API_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Create an instance for Sleeper API
const sleeperApi = axios.create({
  baseURL: SLEEPER_API_URL,
  timeout: 10000,
});

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  updated_at: string;
}

export interface PlayerValuesResponse {
  values: Record<string, number>;
}

export interface PickValuesResponse {
  values: Record<string, number>;
}

interface SleeperPlayer {
  player_id?: string;
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  fantasy_positions?: string[];
  age?: number;
  years_exp?: number;
}

// Convert API player to PlayerData format
const convertApiPlayer = (player: Player): PlayerData => {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team || 'FA',
    age: 0, // Default age
    experience: 0, // Default experience
    stats: {
      position: player.position || '',
      ppg: 0,
      yards: 0,
      td: 0,
      snap_pct: 0,
      rushing_att: 0,
    },
    value: player.value
  };
};

// Fetch players from our Sleeper API 
export const fetchPlayers = async (): Promise<PlayerData[]> => {
  try {
    console.log('Fetching players from Sleeper API...');
    // Use the direct Sleeper API URL
    const response = await sleeperApi.get<SleeperPlayer[]>('/players/nfl');
    console.log('API Response received:', response.status);
    console.log('Number of players received:', response.data ? Object.keys(response.data).length : 0);
    
    // Sleeper returns an object, not an array, so we need to convert it
    const playersObj = response.data || {};
    const playersArray = Object.values(playersObj) as SleeperPlayer[];
    
    console.log('Converted to array, count:', playersArray.length);
    
    // Log a sample player if available
    if (playersArray.length > 0) {
      console.log('Sample player data:', playersArray[0]);
    } else {
      console.log('No player data received from API');
    }
    
    const mappedPlayers = playersArray.map((player: SleeperPlayer) => {
      const mappedPlayer = {
        id: player.player_id || player.id || '',
        name: player.full_name || (player.first_name ? player.first_name + ' ' + player.last_name : '') || '',
        team: player.team || 'FA',
        position: player.position || '',
        age: player.age || 0,
        experience: player.years_exp || 0,
        stats: {
          position: player.position || '',
          ppg: 0,
          yards: 0,
          td: 0,
          snap_pct: 0,
          rushing_att: 0,
        },
        value: player.fantasy_positions?.includes('QB') ? 80 : 60,
      };
      return mappedPlayer;
    });
    
    console.log('Mapped player count:', mappedPlayers.length);
    if (mappedPlayers.length > 0) {
      console.log('Sample mapped player:', mappedPlayers[0]);
    }
    
    return mappedPlayers;
  } catch (error) {
    console.error('Error fetching players from Sleeper API:', error);
    return [];
  }
};

// Get player values from our local SQLite API
export const getPlayerValues = async (): Promise<PlayerValuesResponse> => {
  try {
    const players = await fetchPlayers();
    const values: Record<string, number> = {};
    
    players.forEach(player => {
      values[player.id] = player.value;
    });
    
    return { values };
  } catch (error) {
    console.error('Error getting player values:', error);
    return { values: {} };
  }
};

// Get pick values (mock implementation)
export const getPickValues = async (): Promise<PickValuesResponse> => {
  // Static pick values since our API doesn't support this yet
  const values: Record<string, number> = {
    '1.01': 1000,
    '1.02': 950,
    '1.03': 900,
    '1.04': 850,
    '1.05': 800,
    '1.06': 750,
    '1.07': 700,
    '1.08': 650,
    '1.09': 600,
    '1.10': 550,
    '1.11': 500,
    '1.12': 450,
    '2.01': 400,
    '2.02': 380,
    '2.03': 360,
    '2.04': 340,
    '2.05': 320,
    '2.06': 300,
    '2.07': 280,
    '2.08': 260,
    '2.09': 240,
    '2.10': 220,
    '2.11': 200,
    '2.12': 180,
    '3.01': 160,
    '3.02': 150,
    '3.03': 140,
    '3.04': 130,
    '3.05': 120,
    '3.06': 110,
    '3.07': 100,
    '3.08': 90,
    '3.09': 80,
    '3.10': 70,
    '3.11': 60,
    '3.12': 50,
  };
  
  return { values };
};

// Sync NFL stats by calling our API (for admin use)
export const syncNFLStats = async (): Promise<{ success: boolean; count: number }> => {
  try {
    const response = await api.get<{ success: boolean; count: number }>('/syncNFLStats');
    return response.data;
  } catch (error) {
    console.error('Error syncing NFL stats:', error);
    return { success: false, count: 0 };
  }
}; 