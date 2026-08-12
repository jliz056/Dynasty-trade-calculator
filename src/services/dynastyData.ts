import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Asset, LeagueSettings, Position } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null;

export const hasSupabase = Boolean(supabase);

export interface ProjectedSeason {
  horizon: number;
  projectedAge: number | null;
  projectedPoints: number;
  low: number;
  high: number;
  baseSeason: number | null;
  basePoints: number | null;
  nAnalogs: number;
  statLine: Record<string, number>;
}

export interface Comparable {
  playerId: string;
  name: string;
  position: string;
  similarity: number;
  heightInches: number | null;
  weightLbs: number | null;
  arc: { age: number; points: number }[];
}

export interface AnalogProjection {
  playerId: string;
  name: string;
  position: string;
  heightInches: number | null;
  weightLbs: number | null;
  baseSeason: number | null;
  basePoints: number | null;
  seasons: ProjectedSeason[];
  comparables: Comparable[];
}

const MODEL = 'analog_v1';

export function formatHeight(inches: number | null | undefined): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function formatBuild(
  heightInches: number | null | undefined,
  weightLbs: number | null | undefined,
): string | null {
  const h = formatHeight(heightInches ?? null);
  if (!h) return weightLbs ? `${weightLbs} lbs` : null;
  return weightLbs ? `${h} · ${weightLbs} lbs` : h;
}

/**
 * Map app LeagueSettings to the closest settings_key precomputed by the
 * Python pipeline (data/models/settings.py). The pipeline currently computes
 * 12-team, 1-PPR boards with 1QB/SF and 0/0.5 TE-premium variants.
 */
function settingsKey(settings: LeagueSettings): string {
  const qb = settings.numQbs === 2 ? 'sf' : '1qb';
  const tep = settings.tePremium >= 0.5 ? '05tep' : '0tep';
  return `${qb}-12t-1ppr-${tep}`;
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate).getTime();
  if (Number.isNaN(born)) return null;
  return Math.round(((Date.now() - born) / 31_557_600_000) * 10) / 10;
}

const modelCache = new Map<string, Asset[]>();

/**
 * Our own ranking board (model_version = 'baseline_v1'), built by the Python
 * pipeline from real NFL production + age curves — no KTC/FantasyCalc.
 */
export async function fetchModelRankings(
  settings: LeagueSettings,
): Promise<Asset[]> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const key = settingsKey(settings);
  const cached = modelCache.get(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('dynasty_values')
    .select(
      'value, overall_rank, position_rank, player:players!inner(name, position, team, birth_date, sleeper_id)',
    )
    .eq('settings_key', key)
    .eq('model_version', 'baseline_v1')
    .order('value', { ascending: false })
    .limit(400);
  if (error) throw new Error('Could not load model rankings.');

  const assets: Asset[] = (data ?? []).map((row, i) => {
    const p = row.player as unknown as {
      name: string;
      position: string;
      team: string | null;
      birth_date: string | null;
      sleeper_id: string | null;
    };
    return {
      id: i + 1,
      name: p.name,
      position: (p.position as Position) ?? 'WR',
      team: p.team,
      age: ageFromBirthDate(p.birth_date),
      yoe: null,
      value: Number(row.value),
      overallRank: Number(row.overall_rank ?? i + 1),
      positionRank: Number(row.position_rank ?? 0),
      trend30Day: 0,
      tier: null,
      sleeperId: p.sleeper_id,
    };
  });

  modelCache.set(key, assets);
  return assets;
}

/**
 * Pull the analog-based projection + comparable players for one NFL player,
 * looked up by their Sleeper id. Returns null when nothing is on record (e.g.
 * Supabase not configured, rookie with no NFL season, or rarely-used player).
 */
export async function fetchAnalogProjection(
  sleeperId: string,
): Promise<AnalogProjection | null> {
  if (!supabase) return null;

  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id, name, position, height_inches, weight_lbs')
    .eq('sleeper_id', sleeperId)
    .limit(1);
  if (pErr || !players?.length) return null;
  const player = players[0] as {
    id: string;
    name: string;
    position: string;
    height_inches: number | null;
    weight_lbs: number | null;
  };

  const [{ data: projRows }, { data: compRows }] = await Promise.all([
    supabase
      .from('projections')
      .select('horizon_year, projected_points, low, high, metadata')
      .eq('player_id', player.id)
      .eq('model_version', MODEL)
      .order('horizon_year'),
    supabase
      .from('player_comparables')
      .select('comparable_id, similarity')
      .eq('subject_id', player.id)
      .eq('method', MODEL)
      .order('similarity', { ascending: false })
      .limit(12),
  ]);

  const seasons: ProjectedSeason[] = (projRows ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      horizon: Number(r.horizon_year),
      projectedAge: meta.projected_age != null ? Number(meta.projected_age) : null,
      projectedPoints: Number(r.projected_points),
      low: Number(r.low),
      high: Number(r.high),
      baseSeason: meta.base_season != null ? Number(meta.base_season) : null,
      basePoints: meta.base_points != null ? Number(meta.base_points) : null,
      nAnalogs: Number(meta.n_analogs ?? 0),
      statLine: (meta.stat_line ?? {}) as Record<string, number>,
    };
  });

  const compIds = (compRows ?? []).map((r) => r.comparable_id as string);
  let nameById = new Map<
    string,
    { name: string; position: string; heightInches: number | null; weightLbs: number | null }
  >();
  let arcsById = new Map<string, { age: number; points: number }[]>();

  if (compIds.length) {
    const [{ data: compPlayers }, { data: snaps }] = await Promise.all([
      supabase
        .from('players')
        .select('id, name, position, height_inches, weight_lbs')
        .in('id', compIds),
      supabase
        .from('career_snapshots')
        .select('player_id, age, fantasy_points')
        .in('player_id', compIds)
        .eq('level', 'nfl')
        .order('age'),
    ]);
    for (const cp of compPlayers ?? []) {
      nameById.set(cp.id as string, {
        name: cp.name,
        position: cp.position,
        heightInches: cp.height_inches != null ? Number(cp.height_inches) : null,
        weightLbs: cp.weight_lbs != null ? Number(cp.weight_lbs) : null,
      });
    }
    for (const s of snaps ?? []) {
      const list = arcsById.get(s.player_id as string) ?? [];
      list.push({ age: Number(s.age), points: Number(s.fantasy_points ?? 0) });
      arcsById.set(s.player_id as string, list);
    }
  }

  const comparables: Comparable[] = (compRows ?? []).map((r) => {
    const id = r.comparable_id as string;
    const meta = nameById.get(id);
    return {
      playerId: id,
      name: meta?.name ?? 'Unknown',
      position: meta?.position ?? player.position,
      similarity: Number(r.similarity),
      heightInches: meta?.heightInches ?? null,
      weightLbs: meta?.weightLbs ?? null,
      arc: arcsById.get(id) ?? [],
    };
  });

  if (!seasons.length && !comparables.length) return null;

  return {
    playerId: player.id,
    name: player.name,
    position: player.position,
    heightInches:
      player.height_inches != null ? Number(player.height_inches) : null,
    weightLbs: player.weight_lbs != null ? Number(player.weight_lbs) : null,
    baseSeason: seasons[0]?.baseSeason ?? null,
    basePoints: seasons[0]?.basePoints ?? null,
    seasons,
    comparables,
  };
}
