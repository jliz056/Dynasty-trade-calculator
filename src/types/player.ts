export interface PlayerStats {
  position: string;
  ppg: number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  age?: number;
  experience?: number;
  stats?: PlayerStats;
  value: number;
} 