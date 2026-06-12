import type { VercelRequest, VercelResponse } from '@vercel/node';

// Proxies CollegeFootballData requests so the API key stays server-side.
// Set CFB_API_KEY in the Vercel project environment variables.
const API_URL = 'https://api.collegefootballdata.com';
const SEASONS_TO_TRY = [2025, 2024];
const OFFENSE_CATEGORIES = new Set(['passing', 'rushing', 'receiving']);

async function cfbd<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`CFBD ${path} failed with ${r.status}`);
  return r.json() as Promise<T>;
}

interface CfbdPlayer {
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
  category: string;
  statType: string;
  stat: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.CFB_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'CFB_API_KEY is not configured on the server.' });
    return;
  }
  const name = String(req.query.name ?? '');
  const position = String(req.query.position ?? '');
  if (!name) {
    res.status(400).json({ error: 'Missing name parameter.' });
    return;
  }

  try {
    let player: CfbdPlayer | null = null;
    for (const year of SEASONS_TO_TRY) {
      const results = await cfbd<CfbdPlayer[]>(
        '/player/search',
        { searchTerm: name, year: String(year) },
        key,
      );
      if (results.length > 0) {
        player =
          results.find((p) => p.position?.toUpperCase() === position.toUpperCase()) ?? results[0];
        break;
      }
    }
    if (!player) {
      res.setHeader('Cache-Control', 's-maxage=86400');
      res.status(200).json({ player: null, season: null, stats: {} });
      return;
    }

    for (const year of SEASONS_TO_TRY) {
      const seasonStats = await cfbd<CfbdSeasonStat[]>(
        '/stats/player/season',
        { year: String(year), team: player.team },
        key,
      );
      const own = seasonStats.filter(
        (s) => String(s.playerId) === String(player!.id) && OFFENSE_CATEGORIES.has(s.category),
      );
      if (own.length > 0) {
        const stats: Record<string, Record<string, number>> = {};
        for (const s of own) {
          (stats[s.category] ??= {})[s.statType] = Number(s.stat);
        }
        res.setHeader('Cache-Control', 's-maxage=86400');
        res.status(200).json({ player, season: year, stats });
        return;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).json({ player, season: null, stats: {} });
  } catch {
    res.status(502).json({ error: 'CollegeFootballData request failed.' });
  }
}
