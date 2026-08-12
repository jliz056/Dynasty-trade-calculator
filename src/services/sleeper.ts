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

export interface SleeperStatLine {
  pts_half_ppr?: number;
  pts_ppr?: number;
  pts_std?: number;
  rec?: number;
  gp?: number;
  gs?: number;
  pass_att?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  pass_cmp?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  rec_tgt?: number;
  rec_yd?: number;
  rec_td?: number;
}

export interface PlayerSeasonStats {
  season: number;
  games: number;
  halfPprPoints: number;
  passAttempts: number;
  passYards: number;
  passTds: number;
  passInts: number;
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  targets: number;
  receptions: number;
  recYards: number;
  recTds: number;
}

export interface NflScheduleGame {
  week: number;
  date: string;
  home: string;
  away: string;
  status: string;
  opponent: string;
  isHome: boolean;
}

const SCHEDULE_API = 'https://api.sleeper.com/schedule/nfl';
const scheduleCache = new Map<string, NflScheduleGame[]>();

function num(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseStatLine(season: number, line: SleeperStatLine): PlayerSeasonStats {
  return {
    season,
    games: num(line.gp),
    halfPprPoints: Math.round((line.pts_half_ppr ?? 0) * 10) / 10,
    passAttempts: num(line.pass_att),
    passYards: num(line.pass_yd),
    passTds: num(line.pass_td),
    passInts: num(line.pass_int),
    rushAttempts: num(line.rush_att),
    rushYards: num(line.rush_yd),
    rushTds: num(line.rush_td),
    targets: num(line.rec_tgt),
    receptions: num(line.rec),
    recYards: num(line.rec_yd),
    recTds: num(line.rec_td),
  };
}

const seasonStatsCache = new Map<number, Record<string, SleeperStatLine>>();

/** Per-player regular-season totals for a year, keyed by Sleeper player id. */
export async function fetchSeasonStats(
  season: number,
): Promise<Record<string, SleeperStatLine>> {
  const cached = seasonStatsCache.get(season);
  if (cached) return cached;
  const data = await get<Record<string, SleeperStatLine>>(
    `/stats/nfl/regular/${season}`,
  );
  seasonStatsCache.set(season, data);
  return data;
}

export interface PlayerSeasonProduction {
  season: number;
  halfPprPoints: number;
  receptions: number;
}

/**
 * Most recent season with real production for a player, trying the last
 * completed season first. Returns null if Sleeper has no stats (e.g. rookies).
 */
export async function fetchPlayerProduction(
  sleeperId: string,
  seasonsToTry: number[],
): Promise<PlayerSeasonProduction | null> {
  for (const season of seasonsToTry) {
    try {
      const stats = await fetchSeasonStats(season);
      const line = stats[sleeperId];
      if (line && (line.pts_half_ppr ?? 0) > 0) {
        return {
          season,
          halfPprPoints: Math.round(line.pts_half_ppr ?? 0),
          receptions: Math.round(line.rec ?? 0),
        };
      }
    } catch {
      // try the next season
    }
  }
  return null;
}

/** All seasons with recorded production, newest first. */
export async function fetchPlayerSeasonHistory(
  sleeperId: string,
  firstSeason = 2009,
  lastSeason = new Date().getFullYear(),
): Promise<PlayerSeasonStats[]> {
  const seasons: number[] = [];
  for (let y = lastSeason; y >= firstSeason; y -= 1) seasons.push(y);

  const rows: PlayerSeasonStats[] = [];
  for (const season of seasons) {
    try {
      const stats = await fetchSeasonStats(season);
      const line = stats[sleeperId];
      if (!line || num(line.gp) <= 0) continue;
      rows.push(parseStatLine(season, line));
    } catch {
      // skip missing season
    }
  }
  return rows;
}

interface RawScheduleGame {
  week: number;
  date: string;
  home: string;
  away: string;
  status: string;
}

/** Upcoming + completed games for a team in a given season. */
export async function fetchTeamSchedule(
  team: string,
  season: number,
): Promise<NflScheduleGame[]> {
  const abbr = team.toUpperCase();
  const cacheKey = `${season}:${abbr}`;
  const cached = scheduleCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${SCHEDULE_API}/regular/${season}`);
  if (!res.ok) throw new Error('Schedule request failed.');
  const games = (await res.json()) as RawScheduleGame[];

  const filtered = games
    .filter((g) => g.home === abbr || g.away === abbr)
    .map((g) => ({
      week: g.week,
      date: g.date,
      home: g.home,
      away: g.away,
      status: g.status,
      isHome: g.home === abbr,
      opponent: g.home === abbr ? g.away : g.home,
    }))
    .sort((a, b) => a.week - b.week);

  scheduleCache.set(cacheKey, filtered);
  return filtered;
}

export async function fetchNflSeason(): Promise<number> {
  try {
    const state = await get<{
      season: string;
      season_type?: string;
      previous_season?: string;
    }>('/state/nfl');
    const season = Number(state.season);
    if (state.season_type === 'off' && state.previous_season) {
      return Number(state.previous_season);
    }
    return Number.isFinite(season) ? season : new Date().getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}
