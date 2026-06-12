const API_URL = 'https://api.collegefootballdata.com';
const API_KEY = import.meta.env.VITE_CFB_API_KEY;

// In production the serverless proxy holds the key, so stats may be available
// even without a key in the client bundle.
export const hasCfbdKey = Boolean(API_KEY) || !import.meta.env.DEV;

export interface CfbdPlayer {
  id: string;
  name: string;
  team: string;
  position: string | null;
  height: number | null;
  weight: number | null;
  jersey: number | null;
  hometown: string | null;
}

interface CfbdSeasonStat {
  playerId: string;
  player: string;
  category: string;
  statType: string;
  /** CFBD returns stat values as strings, e.g. "1243" or "14.3" */
  stat: string;
}

export interface CollegeProfile {
  player: CfbdPlayer | null;
  season: number | null;
  /** category -> statType -> value, e.g. stats.receiving.YDS */
  stats: Record<string, Record<string, number>>;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (res.status === 401) {
    throw new Error('Your CollegeFootballData API key was rejected. Check VITE_CFB_API_KEY in .env.');
  }
  if (!res.ok) {
    throw new Error('CollegeFootballData request failed.');
  }
  return res.json();
}

const SEASONS_TO_TRY = [2025, 2024];
const OFFENSE_CATEGORIES = new Set(['passing', 'rushing', 'receiving']);

async function searchPlayer(name: string, position: string): Promise<CfbdPlayer | null> {
  const byPosition = (results: CfbdPlayer[]) =>
    results.find((r) => r.position?.toUpperCase() === position.toUpperCase()) ??
    results[0] ??
    null;

  // A year-scoped search only returns players active that season, which
  // avoids name collisions with older or lower-division players.
  for (const year of SEASONS_TO_TRY) {
    const results = await get<CfbdPlayer[]>('/player/search', {
      searchTerm: name,
      year: String(year),
    });
    if (results.length > 0) return byPosition(results);
  }
  const results = await get<CfbdPlayer[]>('/player/search', { searchTerm: name });
  return byPosition(results);
}

async function fetchViaServerProxy(name: string, position: string): Promise<CollegeProfile> {
  const url = new URL('/api/college', window.location.origin);
  url.searchParams.set('name', name);
  url.searchParams.set('position', position);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? 'CollegeFootballData request failed.');
  }
  return body as CollegeProfile;
}

export async function fetchCollegeProfile(
  name: string,
  position: string,
): Promise<CollegeProfile> {
  if (!API_KEY) return fetchViaServerProxy(name, position);

  const player = await searchPlayer(name, position);
  if (!player) return { player: null, season: null, stats: {} };

  for (const year of SEASONS_TO_TRY) {
    const seasonStats = await get<CfbdSeasonStat[]>('/stats/player/season', {
      year: String(year),
      team: player.team,
    });
    const own = seasonStats.filter(
      (s) => String(s.playerId) === String(player.id) && OFFENSE_CATEGORIES.has(s.category),
    );
    if (own.length > 0) {
      const stats: Record<string, Record<string, number>> = {};
      for (const s of own) {
        (stats[s.category] ??= {})[s.statType] = Number(s.stat);
      }
      return { player, season: year, stats };
    }
  }

  return { player, season: null, stats: {} };
}
