import { externalApi } from './api';
import { PlayerData } from './player';

// RapidAPI configuration
const RAPID_API_KEY = import.meta.env.VITE_RAPID_API_KEY;
const RAPID_API_HOST = import.meta.env.VITE_RAPID_API_HOST;

if (!RAPID_API_KEY || RAPID_API_KEY === 'your_rapidapi_key') {
  console.warn('RapidAPI Key not configured. Please add your key to the .env file.');
}

// Cache for NFL player data
let nflPlayersCache: any[] = [];
let nflStatsCache: Record<string, any> = {};

// Function to fetch all NFL players
export const fetchNFLPlayers = async (): Promise<any[]> => {
  console.log('Fetching NFL players from RapidAPI...');
  
  if (nflPlayersCache.length > 0) {
    console.log('Returning cached NFL players...');
    return nflPlayersCache;
  }

  try {
    const response = await externalApi.get('https://api-nfl.p.rapidapi.com/players', {
      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_API_HOST
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid response data format from NFL API');
      return [];
    }
    
    console.log(`NFL API response received: ${response.data.length} players`);
    nflPlayersCache = response.data;
    return nflPlayersCache;
  } catch (error) {
    console.error('Error fetching NFL players:', error);
    return [];
  }
};

// Function to fetch player statistics by player ID
export const fetchPlayerStats = async (playerId: string, season: number = 2023): Promise<any> => {
  console.log(`Fetching stats for player ${playerId} from NFL API...`);
  
  if (nflStatsCache[`${playerId}-${season}`]) {
    console.log('Returning cached player stats...');
    return nflStatsCache[`${playerId}-${season}`];
  }

  try {
    const response = await externalApi.get(`https://api-nfl.p.rapidapi.com/players/statistics`, {
      params: {
        id: playerId,
        season: season
      },
      headers: {
        'X-RapidAPI-Key': RAPID_API_KEY,
        'X-RapidAPI-Host': RAPID_API_HOST
      }
    });
    
    console.log(`NFL API stats response received for player ${playerId}`);
    nflStatsCache[`${playerId}-${season}`] = response.data;
    return response.data;
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return null;
  }
};

// Function to search players by name
export const searchNFLPlayers = async (query: string): Promise<PlayerData[]> => {
  console.log(`Searching NFL players with query: ${query}`);
  
  if (!query || query.trim().length < 2) {
    console.log('Search query too short');
    return [];
  }
  
  try {
    const allPlayers = await fetchNFLPlayers();
    const searchLower = query.toLowerCase();
    
    const matchedPlayers = allPlayers
      .filter(player => {
        const fullName = `${player.firstname} ${player.lastname}`.toLowerCase();
        return fullName.includes(searchLower);
      })
      .slice(0, 15); // Limit to 15 results
    
    console.log(`Found ${matchedPlayers.length} NFL players matching "${query}"`);
    
    // Convert to our app's PlayerData format
    const convertedPlayers = await Promise.all(matchedPlayers.map(async player => {
      let stats = null;
      
      try {
        // Try to fetch stats for the player
        stats = await fetchPlayerStats(player.id);
      } catch (error) {
        console.error(`Error fetching stats for player ${player.id}:`, error);
      }
      
      return convertNFLPlayerToPlayerData(player, stats);
    }));
    
    return convertedPlayers;
  } catch (error) {
    console.error('Error searching NFL players:', error);
    return [];
  }
};

// Function to get player by ID
export const getNFLPlayerById = async (playerId: string): Promise<PlayerData | null> => {
  try {
    const allPlayers = await fetchNFLPlayers();
    const player = allPlayers.find(p => p.id === playerId);
    
    if (!player) {
      return null;
    }
    
    const stats = await fetchPlayerStats(playerId);
    return convertNFLPlayerToPlayerData(player, stats);
  } catch (error) {
    console.error(`Error fetching NFL player ${playerId}:`, error);
    return null;
  }
};

// Helper function to convert NFL API player format to our app's PlayerData format
const convertNFLPlayerToPlayerData = (player: any, stats: any): PlayerData => {
  let position = player.position || '';
  let team = player.team || 'FA';
  
  // Calculate basic stats based on position
  const playerStats = {
    position: position,
    ppg: calculatePointsPerGame(stats, position),
    yards: calculateTotalYards(stats, position),
    td: calculateTotalTouchdowns(stats, position),
    snap_pct: calculateSnapPercentage(stats),
    rushing_att: calculateRushingAttempts(stats)
  };
  
  return {
    id: player.id.toString(),
    name: `${player.firstname} ${player.lastname}`,
    position: position,
    team: team,
    age: calculateAge(player.birth_date),
    experience: calculateExperience(player.draft_year),
    stats: playerStats,
    value: calculatePlayerValue(player, stats, position)
  };
};

// Helper function to calculate player age
const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;
  
  try {
    const birthYear = new Date(birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  } catch (error) {
    return 0;
  }
};

// Helper function to calculate player experience
const calculateExperience = (draftYear: number): number => {
  if (!draftYear) return 0;
  
  const currentYear = new Date().getFullYear();
  return currentYear - draftYear;
};

// Helper function to calculate points per game
const calculatePointsPerGame = (stats: any, position: string): number => {
  if (!stats || !stats.statistics) return 0;
  
  // Implement PPG calculation based on position and stats
  let totalPoints = 0;
  
  try {
    const seasonStats = stats.statistics;
    
    if (position === 'QB') {
      // QB scoring (example: 0.04 per passing yard, 4 per passing TD, -2 per INT)
      totalPoints += (seasonStats.passing?.yards || 0) * 0.04;
      totalPoints += (seasonStats.passing?.touchdowns || 0) * 4;
      totalPoints += (seasonStats.rushing?.yards || 0) * 0.1;
      totalPoints += (seasonStats.rushing?.touchdowns || 0) * 6;
      totalPoints -= (seasonStats.passing?.interceptions || 0) * 2;
    } else if (position === 'RB') {
      // RB scoring
      totalPoints += (seasonStats.rushing?.yards || 0) * 0.1;
      totalPoints += (seasonStats.rushing?.touchdowns || 0) * 6;
      totalPoints += (seasonStats.receiving?.yards || 0) * 0.1;
      totalPoints += (seasonStats.receiving?.touchdowns || 0) * 6;
      totalPoints += (seasonStats.receiving?.receptions || 0) * 0.5; // Half PPR
    } else if (position === 'WR' || position === 'TE') {
      // WR/TE scoring
      totalPoints += (seasonStats.receiving?.yards || 0) * 0.1;
      totalPoints += (seasonStats.receiving?.touchdowns || 0) * 6;
      totalPoints += (seasonStats.receiving?.receptions || 0) * 0.5; // Half PPR
      totalPoints += (seasonStats.rushing?.yards || 0) * 0.1;
      totalPoints += (seasonStats.rushing?.touchdowns || 0) * 6;
    }
    
    // Calculate PPG
    const games = seasonStats.games_played || 1;
    return parseFloat((totalPoints / games).toFixed(1));
  } catch (error) {
    console.error('Error calculating PPG:', error);
    return 0;
  }
};

// Helper function to calculate total yards
const calculateTotalYards = (stats: any, position: string): number => {
  if (!stats || !stats.statistics) return 0;
  
  try {
    const seasonStats = stats.statistics;
    
    if (position === 'QB') {
      return (seasonStats.passing?.yards || 0) + (seasonStats.rushing?.yards || 0);
    } else if (position === 'RB') {
      return (seasonStats.rushing?.yards || 0) + (seasonStats.receiving?.yards || 0);
    } else if (position === 'WR' || position === 'TE') {
      return (seasonStats.receiving?.yards || 0) + (seasonStats.rushing?.yards || 0);
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating total yards:', error);
    return 0;
  }
};

// Helper function to calculate total touchdowns
const calculateTotalTouchdowns = (stats: any, position: string): number => {
  if (!stats || !stats.statistics) return 0;
  
  try {
    const seasonStats = stats.statistics;
    
    if (position === 'QB') {
      return (seasonStats.passing?.touchdowns || 0) + (seasonStats.rushing?.touchdowns || 0);
    } else if (position === 'RB' || position === 'WR' || position === 'TE') {
      return (seasonStats.rushing?.touchdowns || 0) + (seasonStats.receiving?.touchdowns || 0);
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating total touchdowns:', error);
    return 0;
  }
};

// Helper function to calculate snap percentage
const calculateSnapPercentage = (stats: any): number => {
  if (!stats || !stats.statistics) return 0;
  
  try {
    // This is a mock implementation as snap count might not be directly available
    return Math.min(95, Math.random() * 30 + 65); // Mock value between 65-95%
  } catch (error) {
    return 0;
  }
};

// Helper function to calculate rushing attempts
const calculateRushingAttempts = (stats: any): number => {
  if (!stats || !stats.statistics) return 0;
  
  try {
    return stats.statistics.rushing?.attempts || 0;
  } catch (error) {
    return 0;
  }
};

// Helper function to calculate player value
const calculatePlayerValue = (player: any, stats: any, position: string): number => {
  // Base values by position
  const baseValues: Record<string, number> = {
    'QB': 900,
    'RB': 850,
    'WR': 800,
    'TE': 750,
    'K': 400,
    'DEF': 400
  };
  
  let value = baseValues[position] || 700;
  
  // Age adjustment
  const age = calculateAge(player.birth_date);
  const experience = calculateExperience(player.draft_year);
  
  // Age curve by position
  if (position === 'QB') {
    if (age < 26) value += 50;
    else if (age > 33) value -= (age - 33) * 40;
  } else if (position === 'RB') {
    if (age < 25) value += 50;
    else if (age > 28) value -= (age - 28) * 70;
  } else if (position === 'WR') {
    if (age < 26) value += 50;
    else if (age > 30) value -= (age - 30) * 50;
  } else if (position === 'TE') {
    if (age < 26) value += 30;
    else if (age > 30) value -= (age - 30) * 40;
  }
  
  // Experience adjustment
  if (experience === 0) {
    // Rookies have high potential
    value += 50;
  } else if (experience === 1 || experience === 2) {
    // Second and third year players have good potential
    value += 30;
  } else if (experience > 8) {
    // Veterans have declining value
    value -= (experience - 8) * 20;
  }
  
  // Performance adjustment based on PPG
  const ppg = calculatePointsPerGame(stats, position);
  
  if (position === 'QB') {
    if (ppg > 22) value += (ppg - 22) * 30;
    else if (ppg < 16) value -= (16 - ppg) * 20;
  } else if (position === 'RB') {
    if (ppg > 18) value += (ppg - 18) * 40;
    else if (ppg < 12) value -= (12 - ppg) * 30;
  } else if (position === 'WR') {
    if (ppg > 16) value += (ppg - 16) * 35;
    else if (ppg < 10) value -= (10 - ppg) * 25;
  } else if (position === 'TE') {
    if (ppg > 14) value += (ppg - 14) * 45;
    else if (ppg < 8) value -= (8 - ppg) * 20;
  }
  
  // Draft capital adjustment (if available)
  if (player.draft_round && player.draft_round <= 3) {
    const draftBonus = (4 - player.draft_round) * 20;
    
    // Draft capital matters more for younger players
    if (experience <= 3) {
      value += draftBonus;
    } else {
      value += draftBonus / 2;
    }
  }
  
  // Add some randomness for variety
  value += Math.floor(Math.random() * 50) - 25;
  
  return Math.max(300, Math.round(value));
};

export default {
  fetchNFLPlayers,
  searchNFLPlayers,
  getNFLPlayerById,
  fetchPlayerStats
}; 