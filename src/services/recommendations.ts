import { Asset, Position } from '../types';
import { SleeperLeagueUser, SleeperRoster } from './sleeper';

export interface TeamAnalysis {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  avatar: string | null;
  assets: Asset[];
  unmatchedCount: number;
  totalValue: number;
  starterValue: number;
  starters: Asset[];
  positionValue: Record<Exclude<Position, 'PICK'>, number>;
}

export interface TradeRecommendation {
  partner: TeamAnalysis;
  send: Asset[];
  receive: Asset[];
  myStarterGain: number;
  partnerStarterGain: number;
  valueDiff: number;
}

const SLOT_ELIGIBILITY: Record<string, Position[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  WRRB_WRT: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

export function parseStarterSlots(rosterPositions: string[]): Position[][] {
  return rosterPositions
    .map((p) => SLOT_ELIGIBILITY[p])
    .filter((slot): slot is Position[] => Boolean(slot));
}

function computeStarters(players: Asset[], slots: Position[][]): Asset[] {
  // Fill the most restrictive slots first so flex spots get the leftovers.
  const ordered = [...slots].sort((a, b) => a.length - b.length);
  const pool = [...players].sort((a, b) => b.value - a.value);
  const used = new Set<number>();
  const starters: Asset[] = [];
  for (const slot of ordered) {
    const pick = pool.find((p) => !used.has(p.id) && slot.includes(p.position as never));
    if (pick) {
      used.add(pick.id);
      starters.push(pick);
    }
  }
  return starters;
}

function starterValue(players: Asset[], slots: Position[][]): number {
  return computeStarters(players, slots).reduce((s, p) => s + p.value, 0);
}

export function analyzeTeam(
  roster: SleeperRoster,
  users: SleeperLeagueUser[],
  assetsBySleeperId: Map<string, Asset>,
  slots: Position[][],
): TeamAnalysis {
  const owner = users.find((u) => u.user_id === roster.owner_id);
  const playerIds = roster.players ?? [];
  const assets: Asset[] = [];
  let unmatchedCount = 0;
  for (const id of playerIds) {
    const asset = assetsBySleeperId.get(id);
    if (asset) assets.push(asset);
    else unmatchedCount++;
  }
  assets.sort((a, b) => b.value - a.value);

  const positionValue: TeamAnalysis['positionValue'] = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const a of assets) {
    if (a.position !== 'PICK') positionValue[a.position] += a.value;
  }

  const starters = computeStarters(assets, slots);
  return {
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
    teamName: owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`,
    avatar: owner?.avatar ?? null,
    assets,
    unmatchedCount,
    totalValue: assets.reduce((s, a) => s + a.value, 0),
    starterValue: starters.reduce((s, a) => s + a.value, 0),
    starters,
    positionValue,
  };
}

const MAX_CANDIDATES_PER_SIDE = 15;
const FAIRNESS_TOLERANCE = 0.15;
const MAX_PARTNER_LOSS_RATIO = 0.02;

function pairs<T>(list: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      out.push([list[i], list[j]]);
    }
  }
  return out;
}

export function generateRecommendations(
  me: TeamAnalysis,
  others: TeamAnalysis[],
  slots: Position[][],
): TradeRecommendation[] {
  const all: TradeRecommendation[] = [];
  const myIds = (exclude: Asset[]) => me.assets.filter((a) => !exclude.includes(a));
  const myCandidates = me.assets.slice(0, MAX_CANDIDATES_PER_SIDE);

  for (const partner of others) {
    const theirCandidates = partner.assets.slice(0, MAX_CANDIDATES_PER_SIDE);
    const theirRemaining = (exclude: Asset[]) =>
      partner.assets.filter((a) => !exclude.includes(a));

    const combos: Array<{ send: Asset[]; receive: Asset[] }> = [];
    for (const s of myCandidates) {
      for (const r of theirCandidates) {
        combos.push({ send: [s], receive: [r] });
      }
    }
    for (const [s1, s2] of pairs(myCandidates)) {
      for (const r of theirCandidates) {
        combos.push({ send: [s1, s2], receive: [r] });
      }
    }
    for (const s of myCandidates) {
      for (const [r1, r2] of pairs(theirCandidates)) {
        combos.push({ send: [s], receive: [r1, r2] });
      }
    }

    for (const { send, receive } of combos) {
      const sendValue = send.reduce((s, a) => s + a.value, 0);
      const receiveValue = receive.reduce((s, a) => s + a.value, 0);
      const maxValue = Math.max(sendValue, receiveValue);
      if (Math.abs(sendValue - receiveValue) > maxValue * FAIRNESS_TOLERANCE) continue;

      const myNewStarters = starterValue([...myIds(send), ...receive], slots);
      const myGain = myNewStarters - me.starterValue;
      if (myGain <= 0) continue;

      const partnerNewStarters = starterValue([...theirRemaining(receive), ...send], slots);
      const partnerGain = partnerNewStarters - partner.starterValue;
      if (partnerGain < -partner.starterValue * MAX_PARTNER_LOSS_RATIO) continue;

      all.push({
        partner,
        send,
        receive,
        myStarterGain: myGain,
        partnerStarterGain: partnerGain,
        valueDiff: receiveValue - sendValue,
      });
    }
  }

  all.sort((a, b) => b.myStarterGain - a.myStarterGain);

  // Diversify: max 2 recommendations per partner, no repeated key player.
  const result: TradeRecommendation[] = [];
  const partnerCount = new Map<number, number>();
  const seenKeys = new Set<string>();
  for (const rec of all) {
    const count = partnerCount.get(rec.partner.rosterId) ?? 0;
    if (count >= 2) continue;
    const key = `${rec.receive[0].id}-${rec.send[0].id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    partnerCount.set(rec.partner.rosterId, count + 1);
    result.push(rec);
    if (result.length >= 6) break;
  }
  return result;
}
