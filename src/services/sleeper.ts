import { LeagueSettings } from '../types';

const API_URL = 'https://api.sleeper.app/v1';

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_URL + path);
  if (res.status === 404) throw new Error('Not found');
  if (!res.ok) throw new Error('Sleeper request failed.');
  return res.json();
}

export async function getUser(username: string): Promise<SleeperUser> {
  try {
    return await get<SleeperUser>(`/user/${encodeURIComponent(username.trim())}`);
  } catch {
    throw new Error(`Sleeper user "${username}" not found.`);
  }
}

export async function getLeagues(userId: string): Promise<SleeperLeague[]> {
  const year = new Date().getFullYear();
  for (const season of [year, year - 1]) {
    const leagues = await get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
    if (leagues.length > 0) return leagues;
  }
  return [];
}

export async function getLeagueData(
  leagueId: string,
): Promise<{ rosters: SleeperRoster[]; users: SleeperLeagueUser[] }> {
  const [rosters, users] = await Promise.all([
    get<SleeperRoster[]>(`/league/${leagueId}/rosters`),
    get<SleeperLeagueUser[]>(`/league/${leagueId}/users`),
  ]);
  return { rosters, users };
}

export function detectLeagueSettings(league: SleeperLeague): Partial<LeagueSettings> {
  const qbSlots = league.roster_positions.filter((p) => p === 'QB').length;
  const hasSuperflex = league.roster_positions.includes('SUPER_FLEX');
  const numQbs: 1 | 2 = hasSuperflex || qbSlots >= 2 ? 2 : 1;

  const rec = league.scoring_settings?.rec ?? 1;
  const ppr: 0 | 0.5 | 1 = rec >= 1 ? 1 : rec >= 0.5 ? 0.5 : 0;

  const teBonus = league.scoring_settings?.bonus_rec_te ?? 0;
  const tePremium: 0 | 0.5 | 1 = teBonus >= 1 ? 1 : teBonus >= 0.5 ? 0.5 : 0;

  return { numQbs, ppr, tePremium, numTeams: league.total_rosters };
}

export function sleeperAvatarUrl(avatar: string | null): string | undefined {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : undefined;
}
