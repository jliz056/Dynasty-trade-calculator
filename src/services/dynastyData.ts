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
  matchedAge: number | null;
  modelValue: number | null;
  modelRank: number | null;
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
  modelValue: number | null;
  modelRank: number | null;
  seasons: ProjectedSeason[];
  comparables: Comparable[];
}

const MODEL = 'analog_v2';

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

export interface DivergenceRow {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  modelRank: number;
  marketRank: number;
  rankEdge: number;
  modelValue: number;
  marketValue: number;
}

/**
 * Our board vs the latest FantasyCalc snapshot (market_divergence view).
 * rankEdge > 0 = our model likes the player more than the market (buy signal).
 */
export async function fetchDivergence(
  settings: LeagueSettings,
): Promise<DivergenceRow[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('market_divergence')
    .select('player_id, name, position, team, model_rank, market_rank, rank_edge, model_value, market_value')
    .eq('settings_key', settingsKey(settings))
    .order('market_rank')
    .limit(400);
  if (error) throw new Error('Could not load divergence data.');
  return (data ?? []).map((r) => ({
    playerId: r.player_id as string,
    name: r.name as string,
    position: r.position as string,
    team: (r.team as string | null) ?? null,
    modelRank: Number(r.model_rank),
    marketRank: Number(r.market_rank),
    rankEdge: Number(r.rank_edge),
    modelValue: Number(r.model_value),
    marketValue: Number(r.market_value),
  }));
}

export interface BacktestMetric {
  horizon: number;
  scope: string;
  n: number;
  mae: number;
  medianAbsError: number;
  spearman: number;
  coverage: number;
  attrition: number;
}

/**
 * Backtest quality pooled across all as-of seasons (weighted by sample size).
 */
export async function fetchBacktestMetrics(): Promise<BacktestMetric[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('model_metrics')
    .select('horizon_year, scope, n, mae, median_abs_error, spearman, coverage, attrition')
    .eq('model_version', 'analog_v1');
  if (error) throw new Error('Could not load model metrics.');

  const groups = new Map<string, { horizon: number; scope: string; rows: typeof data }>();
  for (const row of data ?? []) {
    const key = `${row.horizon_year}|${row.scope}`;
    const g = groups.get(key) ?? {
      horizon: Number(row.horizon_year),
      scope: row.scope as string,
      rows: [] as typeof data,
    };
    g.rows.push(row);
    groups.set(key, g);
  }

  const pooled: BacktestMetric[] = [];
  for (const g of groups.values()) {
    const totalN = g.rows.reduce((s, r) => s + Number(r.n), 0);
    if (!totalN) continue;
    const wavg = (field: string) =>
      g.rows.reduce((s, r) => s + Number((r as never)[field] ?? 0) * Number(r.n), 0) /
      totalN;
    pooled.push({
      horizon: g.horizon,
      scope: g.scope,
      n: totalN,
      mae: wavg('mae'),
      medianAbsError: wavg('median_abs_error'),
      spearman: wavg('spearman'),
      coverage: wavg('coverage'),
      attrition: wavg('attrition'),
    });
  }
  return pooled.sort((a, b) => a.horizon - b.horizon || a.scope.localeCompare(b.scope));
}

export const MARKET_SOURCES = ['fantasycalc', 'ktc', 'dynastyprocess'] as const;
export type MarketSource = (typeof MARKET_SOURCES)[number];

export const SOURCE_LABELS: Record<MarketSource, string> = {
  fantasycalc: 'FantasyCalc',
  ktc: 'KeepTradeCut',
  dynastyprocess: 'DynastyProcess',
};

export interface CrossSiteRow {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  modelRank: number | null;
  ranks: Partial<Record<MarketSource, number>>;
  values: Partial<Record<MarketSource, number>>;
}

/**
 * Latest snapshot of every market source side by side, joined on our player
 * registry, plus our own model rank. Sorted by average market rank.
 */
export async function fetchCrossSiteComparison(
  settings: LeagueSettings,
): Promise<CrossSiteRow[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const key = settingsKey(settings);

  const sourceQueries = MARKET_SOURCES.map((source) =>
    supabase!
      .from('market_values')
      .select('player_id, name, position, team, value, overall_rank, snapshot_date')
      .eq('source', source)
      .eq('settings_key', key)
      .not('player_id', 'is', null)
      .order('snapshot_date', { ascending: false })
      .order('value', { ascending: false })
      .limit(900),
  );
  const modelQuery = supabase
    .from('dynasty_values')
    .select('player_id, overall_rank')
    .eq('settings_key', key)
    .eq('model_version', 'baseline_v2')
    .order('value', { ascending: false })
    .limit(400);

  const [sourceResults, modelResult] = await Promise.all([
    Promise.all(sourceQueries),
    modelQuery,
  ]);

  const modelRankById = new Map<string, number>();
  for (const r of modelResult.data ?? []) {
    modelRankById.set(r.player_id as string, Number(r.overall_rank));
  }

  const rows = new Map<string, CrossSiteRow>();
  sourceResults.forEach((res, i) => {
    const source = MARKET_SOURCES[i];
    const data = res.data ?? [];
    if (!data.length) return;
    const latest = data[0].snapshot_date as string;
    for (const r of data) {
      if (r.snapshot_date !== latest) continue;
      const id = r.player_id as string;
      const row = rows.get(id) ?? {
        playerId: id,
        name: r.name as string,
        position: r.position as string,
        team: (r.team as string | null) ?? null,
        modelRank: modelRankById.get(id) ?? null,
        ranks: {},
        values: {},
      };
      row.ranks[source] = Number(r.overall_rank);
      row.values[source] = Number(r.value);
      rows.set(id, row);
    }
  });

  const avgRank = (r: CrossSiteRow) => {
    const ranks = Object.values(r.ranks);
    return ranks.length ? ranks.reduce((s, x) => s + x, 0) / ranks.length : 9999;
  };
  return [...rows.values()].sort((a, b) => avgRank(a) - avgRank(b));
}

const modelCache = new Map<string, Asset[]>();

/**
 * Our own ranking board (model_version = 'baseline_v2').
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
    .eq('model_version', 'baseline_v2')
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
  settings?: LeagueSettings,
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
      .select('comparable_id, similarity, subject_age')
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
  const valueById = new Map<string, { value: number; rank: number }>();

  if (compIds.length) {
    const [{ data: compPlayers }, { data: snaps }, { data: valueRows }] = await Promise.all([
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
      // Our board value for the subject and any still-active comparables.
      supabase
        .from('dynasty_values')
        .select('player_id, value, overall_rank')
        .in('player_id', [player.id, ...compIds])
        .eq('settings_key', settings ? settingsKey(settings) : '1qb-12t-1ppr-0tep')
        .eq('model_version', 'baseline_v2'),
    ]);
    for (const v of valueRows ?? []) {
      valueById.set(v.player_id as string, {
        value: Number(v.value),
        rank: Number(v.overall_rank ?? 0),
      });
    }
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
    const value = valueById.get(id);
    return {
      playerId: id,
      name: meta?.name ?? 'Unknown',
      position: meta?.position ?? player.position,
      similarity: Number(r.similarity),
      heightInches: meta?.heightInches ?? null,
      weightLbs: meta?.weightLbs ?? null,
      matchedAge: r.subject_age != null ? Math.round(Number(r.subject_age)) : null,
      modelValue: value?.value ?? null,
      modelRank: value?.rank ?? null,
      arc: arcsById.get(id) ?? [],
    };
  });

  if (!seasons.length && !comparables.length) return null;

  const subjectValue = valueById.get(player.id);
  return {
    playerId: player.id,
    name: player.name,
    position: player.position,
    heightInches:
      player.height_inches != null ? Number(player.height_inches) : null,
    weightLbs: player.weight_lbs != null ? Number(player.weight_lbs) : null,
    baseSeason: seasons[0]?.baseSeason ?? null,
    basePoints: seasons[0]?.basePoints ?? null,
    modelValue: subjectValue?.value ?? null,
    modelRank: subjectValue?.rank ?? null,
    seasons,
    comparables,
  };
}
