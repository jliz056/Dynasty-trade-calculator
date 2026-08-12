import { LeagueSettings, Position } from '../types';

/**
 * Browser port of the Phase 2 baseline valuation engine.
 *
 * Source of truth: data/models/age_curves.py and data/models/baseline_values.py.
 * Keep the constants below in sync with the Python pipeline. This lets the ML
 * Lab run projections live in the browser with no database, so the formula can
 * be tested before the Supabase-backed devy model comes online.
 */

const PEAK_AGE: Record<string, number> = { QB: 28, RB: 24, WR: 26, TE: 27 };
const RISE_SPREAD: Record<string, number> = { QB: 5, RB: 2.5, WR: 3.5, TE: 4 };
const FALL_SPREAD: Record<string, number> = { QB: 6, RB: 2.8, WR: 4, TE: 4.5 };
const DEFAULT_PEAK = 26;
const DEFAULT_RISE = 3.5;
const DEFAULT_FALL = 4;

export const PROJECTION_YEARS = 3;
const DISCOUNT = 0.82;

/** 0..1 production multiplier for a position at a given age (asymmetric Gaussian). */
export function ageMultiplier(position: string, age: number): number {
  const pos = (position || '').toUpperCase();
  const peak = PEAK_AGE[pos] ?? DEFAULT_PEAK;
  const spread =
    age <= peak ? RISE_SPREAD[pos] ?? DEFAULT_RISE : FALL_SPREAD[pos] ?? DEFAULT_FALL;
  return Math.exp(-((age - peak) ** 2) / (2 * spread * spread));
}

function projectionRatio(position: string, age: number, yearsOut: number): number {
  const now = Math.max(ageMultiplier(position, age), 0.01);
  return ageMultiplier(position, age + yearsOut) / now;
}

function positionSettingsMultiplier(position: string, s: LeagueSettings): number {
  const pos = (position || '').toUpperCase();
  let mult = 1;
  if (pos === 'QB' && s.numQbs === 2) mult *= 1.6;
  if (pos === 'TE' && s.tePremium > 0) mult *= 1 + 0.25 * s.tePremium;
  return mult;
}

function pprPointsDelta(receptions: number, s: LeagueSettings): number {
  return (s.ppr - 0.5) * (receptions || 0);
}

export interface SeasonProjection {
  yearOffset: number;
  age: number;
  projectedPoints: number;
  ageMultiplier: number;
}

export interface ProjectionResult {
  seasons: SeasonProjection[];
  dynastyScore: number;
  scaledValue: number;
}

// Elite young asset (~350 half-PPR points held flat) used to scale to ~10000.
const REFERENCE_RAW = (() => {
  let raw = 0;
  for (let k = 0; k < PROJECTION_YEARS; k += 1) raw += 350 * DISCOUNT ** k;
  return raw;
})();

export interface ProjectionInput {
  position: Position;
  age: number;
  lastSeasonPoints: number;
  receptions?: number;
  settings: LeagueSettings;
}

export function projectPlayer(input: ProjectionInput): ProjectionResult {
  const { position, age, lastSeasonPoints, receptions = 0, settings } = input;
  const base = lastSeasonPoints + pprPointsDelta(receptions, settings);
  const posMult = positionSettingsMultiplier(position, settings);

  const seasons: SeasonProjection[] = [];
  let raw = 0;
  for (let k = 0; k < PROJECTION_YEARS; k += 1) {
    const ratio = projectionRatio(position, age, k);
    const projected = base * ratio * posMult;
    raw += projected * DISCOUNT ** k;
    seasons.push({
      yearOffset: k,
      age: age + k,
      projectedPoints: Math.round(projected * 10) / 10,
      ageMultiplier: Math.round(ageMultiplier(position, age + k) * 1000) / 1000,
    });
  }

  return {
    seasons,
    dynastyScore: Math.round(raw * 10) / 10,
    scaledValue: Math.max(0, Math.round((10000 * raw) / REFERENCE_RAW)),
  };
}

export function ageCurve(
  position: string,
  minAge = 21,
  maxAge = 35,
): { age: number; mult: number }[] {
  const out: { age: number; mult: number }[] = [];
  for (let a = minAge; a <= maxAge; a += 1) {
    out.push({ age: a, mult: ageMultiplier(position, a) });
  }
  return out;
}
