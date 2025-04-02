import { externalApi } from './api';
import { PlayerStats } from './trade';
import nflApi from './nflApi';

const SLEEPER_API_URL = import.meta.env.VITE_SLEEPER_API_URL;

console.log('Sleeper API URL:', SLEEPER_API_URL); // Debug log

export interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number;
  experience: number;
  stats: PlayerStats;
  value: number;
}

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  age: number;
  experience: number;
  fantasy_positions: string[];
  status: string;
  active: boolean;
}

// Cache for Sleeper players
let sleeperPlayersCache: Record<string, SleeperPlayer> = {};

// Function to fetch all players from Sleeper API
export const fetchSleeperPlayers = async (): Promise<Record<string, SleeperPlayer>> => {
  console.log('Fetching players from Sleeper...'); // Debug log
  
  if (Object.keys(sleeperPlayersCache).length > 0) {
    console.log('Returning cached players...'); // Debug log
    return sleeperPlayersCache;
  }

  if (!SLEEPER_API_URL) {
    console.error('SLEEPER_API_URL is not defined');
    return {};
  }

  try {
    const url = `${SLEEPER_API_URL}/players/nfl`;
    console.log('Making API request to:', url); // Debug log
    
    const response = await externalApi.get(url);
    
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid response data:', response.data);
      return {};
    }
    
    console.log('API response received:', response.status); // Debug log
    sleeperPlayersCache = response.data as Record<string, SleeperPlayer>;
    console.log('Players cached, count:', Object.keys(sleeperPlayersCache).length); // Debug log
    return sleeperPlayersCache;
  } catch (error) {
    console.error('Error fetching players from Sleeper:', error);
    return {};
  }
};

// Convert Sleeper player to PlayerData format
const convertSleeperPlayer = (player: SleeperPlayer): PlayerData => {
  return {
    id: player.player_id,
    name: player.full_name,
    position: player.position,
    team: player.team || 'FA',
    age: player.age || 0,
    experience: player.experience || 0,
    stats: {
      position: player.position,
      ppg: 0,
      yards: 0,
      td: 0,
      snap_pct: 0,
      rushing_att: 0
    },
    value: calculateBaseValue(player) // We'll implement this function
  };
};

// Enhanced interfaces to support our comprehensive algorithm
interface PlayerContract {
  yearsRemaining: number;
  averageAnnualValue: number;
  guaranteedMoney: number;
}

interface DraftInfo {
  year: number;
  round: number;
  pick: number;
  college: string;
}

interface InjuryHistory {
  severity: number; // 1-5 scale (5 being most severe)
  gamesLost: number;
  bodyPart: string;
  year: number;
}

interface EnhancedPlayerStats extends PlayerStats {
  // Advanced metrics
  targetShare?: number; // Percentage of team targets
  touchShare?: number; // Percentage of team touches
  redZoneOpportunities?: number;
  yardsPerTouch?: number;
  yardsPerTarget?: number;
  breakTackleRate?: number;
  contestedCatchRate?: number;
  routeParticipation?: number;
  airYards?: number;
  adot?: number; // Average depth of target
  
  // Historical performance
  lastYearPPG?: number;
  weeklyConsistency?: number; // Standard deviation of scores
  playoffPerformance?: number;
  
  // Team situation metrics
  qbQuality?: number; // 1-100 rating
  offensiveLineRank?: number;
  targetCompetition?: number; // 1-100 rating (lower is better)
  offensiveScheme?: string;
  playCallingTendencies?: {
    passRate: number;
    rushRate: number;
  };
}

interface EnhancedSleeperPlayer extends SleeperPlayer {
  contract?: PlayerContract;
  draftInfo?: DraftInfo;
  injuries?: InjuryHistory[];
  enhancedStats?: EnhancedPlayerStats;
  teamSituation?: {
    offensiveRank: number;
    qbQuality: number;
    coachStability: number;
    scheduleStrength: number;
  };
}

// Calculate a comprehensive value for players
const calculatePlayerValue = (player: SleeperPlayer): number => {
  if (!player) return 0;

  // Base value by position (1000 scale)
  let positionBaseValues: {[key: string]: number} = {
    'QB': 1000,
    'RB': 950,
    'WR': 975,
    'TE': 850,
    'K': 500,
    'DEF': 550
  };
  
  let value = positionBaseValues[player.position] || 800;
  
  // 1. Base stats and position adjustment
  // ==================================
  // We'll weight positions differently based on typical league settings
  const positionMultipliers: {[key: string]: number} = {
    'QB': 1.2,  // QBs are more valuable in Superflex/2QB leagues
    'RB': 1.1,  // RBs have shorter careers but higher short-term impact
    'WR': 1.05, // WRs have longer careers and consistent production
    'TE': 0.9,  // TEs are less valuable unless premium scoring
  };
  
  value *= positionMultipliers[player.position] || 1.0;
  
  // 2. Age-based curve by position
  // ==========================
  const age = player.age || 25; // Default to 25 if age unknown
  
  // Define prime age ranges by position
  const positionPrimeAges: {[key: string]: {start: number, peak: number, end: number}} = {
    'QB': {start: 25, peak: 30, end: 35},
    'RB': {start: 23, peak: 25, end: 27},
    'WR': {start: 24, peak: 27, end: 30},
    'TE': {start: 26, peak: 29, end: 32},
  };
  
  const primeAges = positionPrimeAges[player.position] || {start: 24, peak: 27, end: 30};
  
  // Calculate age multiplier based on position-specific curve
  let ageMultiplier = 1.0;
  
  if (age < primeAges.start) {
    // Rising value for young players with potential
    ageMultiplier = 0.8 + (0.2 * (age / primeAges.start));
    
    // Bonus for very young players with potential
    if (age <= primeAges.start - 2) {
      ageMultiplier += 0.1;
    }
  } else if (age >= primeAges.start && age <= primeAges.peak) {
    // Approaching prime - increasing value
    const primeProgress = (age - primeAges.start) / (primeAges.peak - primeAges.start);
    ageMultiplier = 1.0 + (0.15 * primeProgress);
  } else if (age > primeAges.peak && age <= primeAges.end) {
    // In prime but declining slightly
    const declineProgress = (age - primeAges.peak) / (primeAges.end - primeAges.peak);
    ageMultiplier = 1.15 - (0.15 * declineProgress);
  } else {
    // Past prime - declining value
    const yearsAfterPrime = age - primeAges.end;
    ageMultiplier = 1.0 - (0.1 * yearsAfterPrime);
    
    // Steeper decline for older players
    if (yearsAfterPrime > 3) {
      ageMultiplier -= 0.1 * (yearsAfterPrime - 3);
    }
    
    // Floor at 0.3
    ageMultiplier = Math.max(0.3, ageMultiplier);
  }
  
  value *= ageMultiplier;
  
  // 3. Experience adjustment
  // ======================
  const experience = player.experience || 0;
  let experienceMultiplier = 1.0;
  
  if (experience === 0) {
    // Rookies - higher variance but high potential
    experienceMultiplier = 0.9;
  } else if (experience === 1) {
    // Second year - "sophomore leap" potential
    experienceMultiplier = 1.05;
  } else if (experience >= 2 && experience <= 4) {
    // Prime development years
    experienceMultiplier = 1.1;
  } else if (experience >= 5 && experience <= 7) {
    // Established veterans
    experienceMultiplier = 1.0;
  } else if (experience >= 8 && experience <= 10) {
    // Aging veterans
    experienceMultiplier = 0.9;
  } else {
    // Declining veterans
    experienceMultiplier = 0.8 - (0.05 * (experience - 10));
    experienceMultiplier = Math.max(0.5, experienceMultiplier);
  }
  
  value *= experienceMultiplier;
  
  // 4. Team situation and role (mock data)
  // ===================================
  // In a real implementation, we would fetch this data
  const teamStrength: {[key: string]: number} = {
    'KC': 1.2,  // Top offenses
    'BUF': 1.15,
    'SF': 1.15,
    'PHI': 1.1,
    'CIN': 1.1,
    'DAL': 1.1,
    'DET': 1.1,
    'MIA': 1.05,
    'LAR': 1.05,
    'BAL': 1.05,
    'GB': 1.0,
    'MIN': 1.0,
    'NYJ': 1.0,
    'JAX': 1.0,
    'CHI': 0.95,
    'HOU': 0.95,
    'IND': 0.95,
    'TB': 0.95,
    'ATL': 0.95,
    'LV': 0.9,
    'TEN': 0.9,
    'WAS': 0.9,
    'PIT': 0.9,
    'LAC': 0.9,
    'ARI': 0.85,
    'CAR': 0.85,
    'NE': 0.85,
    'CLE': 0.85,
    'DEN': 0.85,
    'NYG': 0.85,
    'SEA': 0.85,
    'NO': 0.85,
  };
  
  const teamMultiplier = teamStrength[player.team || ''] || 1.0;
  value *= teamMultiplier;
  
  // 5. Mock draft capital adjustment
  // ============================
  // In reality, we would fetch this data
  // Higher draft picks get more opportunities
  const mockDraftRound = Math.floor(Math.random() * 7) + 1;
  const draftCapitalMultiplier = mockDraftRound === 1 ? 1.15 :
                               mockDraftRound === 2 ? 1.08 :
                               mockDraftRound === 3 ? 1.03 :
                               mockDraftRound === 4 ? 1.0 :
                               0.95;
  
  value *= draftCapitalMultiplier;
  
  // 6. Position scarcity adjustment
  // ===========================
  const scarcityMultiplier = player.position === 'RB' ? 1.05 :
                            player.position === 'TE' ? 1.03 :
                            1.0;
  
  value *= scarcityMultiplier;
  
  // 7. Mock performance metrics adjustment
  // ==================================
  // In reality, we would fetch this data
  const performanceMultiplier = 0.8 + (Math.random() * 0.4); // Random 0.8-1.2 multiplier for mock data
  value *= performanceMultiplier;
  
  // Final random adjustment to add some variability
  const randomFactor = 0.95 + (Math.random() * 0.1); // +/- 5% random variation
  value *= randomFactor;
  
  // Round to nearest integer
  return Math.round(value);
};

// Replace the original calculateBaseValue with our enhanced version
const calculateBaseValue = calculatePlayerValue;

export const searchPlayers = async (query: string, position?: string): Promise<PlayerData[]> => {
  console.log('Searching players with query:', query); // Debug log
  
  if (!query || query.trim().length < 2) {
    console.log('Search query too short, returning empty results');
    return [];
  }
  
  try {
    // First try to search using the NFL API
    const nflResults = await nflApi.searchNFLPlayers(query);
    
    if (nflResults.length > 0) {
      console.log('Using NFL API results:', nflResults.length);
      
      // Filter by position if specified
      if (position) {
        return nflResults.filter(player => player.position === position);
      }
      
      return nflResults;
    }
    
    // Fall back to Sleeper API if NFL API returns no results
    console.log('No NFL API results, falling back to Sleeper API');
    const players = await fetchSleeperPlayers();
    
    if (!players || typeof players !== 'object') {
      console.error('Invalid players data received from API');
      return [];
    }
    
    const searchLower = query.toLowerCase();
    
    const filteredPlayers = Object.values(players)
      .filter(player => {
        if (!player || !player.full_name) return false;
        
        return (
          player.active && // Only active players
          (!position || player.position === position) && // Match position if specified
          player.full_name.toLowerCase().includes(searchLower) && // Match name
          ['QB', 'RB', 'WR', 'TE'].includes(player.position || '') // Only main positions
        );
      })
      .map(convertSleeperPlayer)
      .sort((a, b) => b.value - a.value) // Sort by value
      .slice(0, 10); // Limit to top 10 results
    
    console.log('Search results:', filteredPlayers.length, 'players found'); // Debug log
    return filteredPlayers;
  } catch (error) {
    console.error('Error searching players:', error);
    return [];
  }
};

export const getPlayerById = async (playerId: string): Promise<PlayerData | null> => {
  try {
    // First try to get player from NFL API
    const nflPlayer = await nflApi.getNFLPlayerById(playerId);
    
    if (nflPlayer) {
      return nflPlayer;
    }
    
    // Fall back to Sleeper API
    const players = await fetchSleeperPlayers();
    const player = players[playerId];
    return player ? convertSleeperPlayer(player) : null;
  } catch (error) {
    console.error('Error fetching player:', error);
    return null;
  }
};

interface PlayersResponse {
  players: PlayerData[];
  totalCount: number;
}

interface PlayerValuesResponse {
  values: Record<string, number>;
}

interface PickValuesResponse {
  values: Record<string, number>;
}

// Mock data for development
const mockPlayers: PlayerData[] = [
  {
    id: "1",
    name: "Patrick Mahomes",
    position: "QB",
    team: "KC",
    age: 28,
    experience: 7,
    stats: {
      position: "QB",
      ppg: 22.5,
      yards: 4183,
      td: 35,
      snap_pct: 98,
      rushing_att: 45
    },
    value: 9800
  },
  {
    id: "2",
    name: "Justin Jefferson",
    position: "WR",
    team: "MIN",
    age: 24,
    experience: 4,
    stats: {
      position: "WR",
      ppg: 19.8,
      yards: 1074,
      td: 8,
      snap_pct: 92,
      rushing_att: 0
    },
    value: 9500
  },
  {
    id: "3",
    name: "Christian McCaffrey",
    position: "RB",
    team: "SF",
    age: 27,
    experience: 7,
    stats: {
      position: "RB",
      ppg: 21.8,
      yards: 1459,
      td: 21,
      snap_pct: 81,
      rushing_att: 272
    },
    value: 9200
  }
];

export const getPlayers = async (pageSize: number = 50, page: number = 1): Promise<PlayersResponse> => {
  // This would be a real API call in production
  // For now, just return mock data
  return {
    players: mockPlayers,
    totalCount: mockPlayers.length
  };
};

export const getPlayerValues = async (): Promise<PlayerValuesResponse> => {
  // This would be a real API call in production
  // For now, just return mock data
  return {
    values: {
      "1": 9800,
      "2": 9500,
      "3": 9200
    }
  };
};

interface DraftPickValue {
  round: number;
  pick?: number;
  value: number;
}

// Placeholder data for pick values
const pickValues: DraftPickValue[] = [
  { round: 1, pick: 1, value: 3000 },
  { round: 1, pick: 2, value: 2800 },
  { round: 1, pick: 3, value: 2600 },
  { round: 1, pick: 4, value: 2400 },
  { round: 1, pick: 5, value: 2200 },
  { round: 1, pick: 6, value: 2000 },
  { round: 1, pick: 7, value: 1900 },
  { round: 1, pick: 8, value: 1800 },
  { round: 1, pick: 9, value: 1700 },
  { round: 1, pick: 10, value: 1600 },
  { round: 1, pick: 11, value: 1500 },
  { round: 1, pick: 12, value: 1400 },
  { round: 2, value: 1000 },
  { round: 3, value: 500 },
  { round: 4, value: 300 },
  { round: 5, value: 200 }
];

export const getPickValues = async (): Promise<PickValuesResponse> => {
  // Convert the pick values to the expected format
  const valueMap: Record<string, number> = {};
  
  pickValues.forEach(pick => {
    if (pick.pick) {
      valueMap[`${pick.round}.${pick.pick}`] = pick.value;
    } else {
      valueMap[`${pick.round}`] = pick.value;
    }
  });
  
  return { values: valueMap };
}; 