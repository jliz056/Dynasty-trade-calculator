export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'PICK';

export interface Asset {
  id: number;
  name: string;
  position: Position;
  team: string | null;
  age: number | null;
  yoe: number | null;
  value: number;
  overallRank: number;
  positionRank: number;
  trend30Day: number;
  tier: number | null;
  sleeperId: string | null;
}

export interface LeagueSettings {
  numQbs: 1 | 2;
  numTeams: number;
  ppr: 0 | 0.5 | 1;
  tePremium: 0 | 0.5 | 1;
}

export const DEFAULT_SETTINGS: LeagueSettings = {
  numQbs: 1,
  numTeams: 12,
  ppr: 1,
  tePremium: 0,
};

export interface SavedTradeAsset {
  id: number;
  name: string;
  position: Position;
  team: string | null;
  value: number;
  sleeperId: string | null;
}

export interface SavedTrade {
  id: string;
  userId: string;
  createdAt: number;
  settings: LeagueSettings;
  sideA: SavedTradeAsset[];
  sideB: SavedTradeAsset[];
  totalA: number;
  totalB: number;
  verdict: string;
}
