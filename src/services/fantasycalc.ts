import { Asset, LeagueSettings, Position } from '../types';

const API_URL = 'https://api.fantasycalc.com/values/current';

interface FantasyCalcEntry {
  player: {
    id: number;
    name: string;
    position: string;
    maybeTeam: string | null;
    maybeAge: number | null;
    maybeYoe: number | null;
    sleeperId: string | null;
  };
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
  maybeTier: number | null;
}

const cache = new Map<string, Asset[]>();

async function fetchBaseValues(settings: LeagueSettings): Promise<Asset[]> {
  const key = `${settings.numQbs}-${settings.numTeams}-${settings.ppr}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    isDynasty: 'true',
    numQbs: String(settings.numQbs),
    numTeams: String(settings.numTeams),
    ppr: String(settings.ppr),
  });
  const res = await fetch(`${API_URL}?${params}`);
  if (!res.ok) {
    throw new Error('Could not load player values from FantasyCalc.');
  }
  const data: FantasyCalcEntry[] = await res.json();

  const assets: Asset[] = data.map((entry) => ({
    id: entry.player.id,
    name: entry.player.name,
    position: (entry.player.position as Position) ?? 'PICK',
    team: entry.player.maybeTeam,
    age: entry.player.maybeAge,
    yoe: entry.player.maybeYoe,
    value: entry.value,
    overallRank: entry.overallRank,
    positionRank: entry.positionRank,
    trend30Day: entry.trend30Day,
    tier: entry.maybeTier,
    sleeperId: entry.player.sleeperId,
  }));

  cache.set(key, assets);
  return assets;
}

/**
 * FantasyCalc has no TE-premium parameter, so we approximate it client-side:
 * +0.5 TEP boosts TE values ~12%, +1.0 TEP ~25%, then re-rank.
 */
export async function fetchValues(settings: LeagueSettings): Promise<Asset[]> {
  const base = await fetchBaseValues(settings);
  if (settings.tePremium === 0) return base;

  const multiplier = 1 + settings.tePremium * 0.25;
  const boosted = base.map((asset) =>
    asset.position === 'TE'
      ? { ...asset, value: Math.round(asset.value * multiplier) }
      : asset,
  );
  boosted.sort((a, b) => b.value - a.value);

  const positionCounts: Record<string, number> = {};
  return boosted.map((asset, i) => {
    positionCounts[asset.position] = (positionCounts[asset.position] ?? 0) + 1;
    return {
      ...asset,
      overallRank: i + 1,
      positionRank: positionCounts[asset.position],
    };
  });
}

export function headshotUrl(asset: { sleeperId: string | null; position: Position }): string | null {
  if (asset.position === 'PICK') return null;
  if (!asset.sleeperId || !/^\d+$/.test(asset.sleeperId)) return null;
  return `https://sleepercdn.com/content/nfl/players/thumb/${asset.sleeperId}.jpg`;
}
