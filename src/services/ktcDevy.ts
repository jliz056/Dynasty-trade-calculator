import { LeagueSettings, Position } from '../types';

export interface DevyPlayer {
  id: number;
  name: string;
  position: Position;
  college: string | null;
  draftYear: number | null;
  value: number;
  rank: number;
  positionalRank: number;
  trend: number;
  tier: number | null;
}

interface KtcValueSet {
  value: number;
  overallTrend: number;
  overallTier: number;
  tep: { value: number };
  tepp: { value: number };
}

interface KtcEntry {
  playerID: number;
  playerName: string;
  position: string;
  team: string | null;
  seasonsExperience: number;
  oneQBValues: KtcValueSet;
  superflexValues: KtcValueSet;
}

let rawCache: KtcEntry[] | null = null;

async function fetchRaw(): Promise<KtcEntry[]> {
  if (rawCache) return rawCache;

  if (import.meta.env.DEV) {
    // In dev the Vite proxy forwards to KTC and we parse the page ourselves.
    const res = await fetch('/ktc/devy-rankings');
    if (!res.ok) throw new Error('Could not load devy rankings from KeepTradeCut.');
    const html = await res.text();
    const match = html.match(/var playersArray = (\[[\s\S]*?\]);/);
    if (!match) throw new Error('Could not parse devy rankings data.');
    rawCache = JSON.parse(match[1]) as KtcEntry[];
  } else {
    // In production a cached serverless function does the scraping.
    const res = await fetch('/api/devy');
    if (!res.ok) throw new Error('Could not load devy rankings.');
    rawCache = (await res.json()) as KtcEntry[];
  }
  return rawCache;
}

function pickValue(values: KtcValueSet, tePremium: LeagueSettings['tePremium']): number {
  if (tePremium === 0.5) return values.tep.value;
  if (tePremium === 1) return values.tepp.value;
  return values.value;
}

/**
 * KTC devy values are on their own scale (top player = 9999) and are not
 * comparable to FantasyCalc dynasty values, so they live in their own tab.
 */
export async function fetchDevyValues(settings: LeagueSettings): Promise<DevyPlayer[]> {
  const raw = await fetchRaw();

  const players = raw.map((entry) => {
    const values = settings.numQbs === 2 ? entry.superflexValues : entry.oneQBValues;
    return {
      id: entry.playerID,
      name: entry.playerName,
      position: entry.position as Position,
      college: entry.team,
      draftYear: entry.seasonsExperience > 2000 ? entry.seasonsExperience : null,
      value: pickValue(values, settings.tePremium),
      rank: 0,
      positionalRank: 0,
      trend: values.overallTrend,
      tier: values.overallTier ?? null,
    };
  });

  players.sort((a, b) => b.value - a.value);

  const positionCounts: Record<string, number> = {};
  return players.map((p, i) => {
    positionCounts[p.position] = (positionCounts[p.position] ?? 0) + 1;
    return { ...p, rank: i + 1, positionalRank: positionCounts[p.position] };
  });
}
