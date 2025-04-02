import axios from 'axios';

const SLEEPER_API_BASE_URL = import.meta.env.VITE_SLEEPER_API_URL;

interface SleeperPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string;
  stats: {
    season: string;
    games: number;
    fantasy_points: number;
    targets?: number;
    receptions?: number;
    receiving_yards?: number;
    receiving_td?: number;
    rushing_yards?: number;
    rushing_td?: number;
    passing_yards?: number;
    passing_td?: number;
    interceptions?: number;
  }[];
}

const sleeperApi = axios.create({
  baseURL: SLEEPER_API_BASE_URL,
});

export const getPlayerSleeperStats = async (playerId: string): Promise<SleeperPlayer> => {
  try {
    const response = await sleeperApi.get(`/players/${playerId}`);
    return response.data as SleeperPlayer;
  } catch (error) {
    console.error('Error fetching Sleeper player stats:', error);
    throw new Error('Failed to fetch Sleeper player stats');
  }
};

export const getLeaguePlayers = async (leagueId: string): Promise<SleeperPlayer[]> => {
  try {
    const response = await sleeperApi.get(`/league/${leagueId}/players`);
    return response.data as SleeperPlayer[];
  } catch (error) {
    console.error('Error fetching league players:', error);
    throw new Error('Failed to fetch league players');
  }
};

export const getPlayerStats = async (playerId: string, season: string): Promise<SleeperPlayer['stats'][0]> => {
  try {
    const response = await sleeperApi.get(`/players/${playerId}/stats/${season}`);
    return response.data as SleeperPlayer['stats'][0];
  } catch (error) {
    console.error('Error fetching player stats:', error);
    throw new Error('Failed to fetch player stats');
  }
}; 