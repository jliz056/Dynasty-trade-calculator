import axios from 'axios';

const COLLEGE_FOOTBALL_API_BASE_URL = import.meta.env.VITE_COLLEGE_FOOTBALL_API_URL;

interface CollegeFootballPlayer {
  id: string;
  name: string;
  school: string;
  position: string;
  stats: {
    season: string;
    games: number;
    comp?: number;
    att?: number;
    yards?: number;
    td?: number;
    int?: number;
    rushYards?: number;
    rushTD?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTD?: number;
    tackles?: number;
    sacks?: number;
    interceptions?: number;
  }[];
}

const collegeFootballApi = axios.create({
  baseURL: COLLEGE_FOOTBALL_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_COLLEGE_FOOTBALL_API_KEY}`,
  },
});

export const getPlayerCollegeStats = async (playerName: string, school: string): Promise<CollegeFootballPlayer> => {
  try {
    const response = await collegeFootballApi.get(`/player/search`, {
      params: {
        searchTerm: playerName,
        school: school,
      },
    });
    return response.data as CollegeFootballPlayer;
  } catch (error) {
    console.error('Error fetching college football stats:', error);
    throw new Error('Failed to fetch college football stats');
  }
};

export const getSchoolPlayers = async (school: string): Promise<CollegeFootballPlayer[]> => {
  try {
    const response = await collegeFootballApi.get(`/roster`, {
      params: {
        school: school,
      },
    });
    return response.data as CollegeFootballPlayer[];
  } catch (error) {
    console.error('Error fetching school players:', error);
    throw new Error('Failed to fetch school players');
  }
}; 