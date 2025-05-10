export interface PlayerDoc {
  playerId: string; // Sleeper player_id
  firstName?: string;
  lastName?: string;
  position?: string;
  team?: string;
  college?: string;
  draftYear?: number;
  draftPick?: number;
  dynastyADP?: number;
  injuryStatus?: string | null;
}

export interface SeasonStat {
  playerId: string;
  season: number;
  games: number;
  pprPoints: number;
  // optional more stats
  targets?: number;
  receptions?: number;
  rushingYards?: number;
  passingYards?: number;
  touchdowns?: number;
} 