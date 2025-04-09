import fetch from 'node-fetch';

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  active: boolean;
  age?: number;
  years_exp?: number;
  [key: string]: any;
}

interface PlayerStats {
  ppg: string | number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
  targets?: number;
  receptions?: number;
  passing_yards?: number;
  passing_td?: number;
  passing_int?: number;
  rushing_yards?: number;
  rushing_td?: number;
  receiving_yards?: number;
  receiving_td?: number;
}

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  age: number;
  experience: number;
  stats: PlayerStats;
}

export async function fetchNFLPlayers() {
  const url = 'https://api.sleeper.app/v1/players/nfl';
  const res = await fetch(url);
  const data = await res.json() as Record<string, SleeperPlayer>;

  // Simplify and format player data
  const players: Player[] = Object.values(data)
    .filter((p: SleeperPlayer) => p.active && p.position && p.team)
    .map((p: SleeperPlayer) => {
      // Generate realistic player stats based on position
      let stats = generateMockStats(p.position);
      
      return {
        id: p.player_id,
        name: p.full_name,
        position: p.position,
        team: p.team,
        value: calculatePlayerValue(p.position),
        age: p.age || Math.floor(Math.random() * 10) + 22, // Random age between 22-32
        experience: p.years_exp || Math.floor(Math.random() * 8), // Random experience 0-8 years
        stats
      };
    });

  return players;
}

function calculatePlayerValue(position: string): number {
  // Base value ranges by position
  const valueRanges = {
    'QB': { min: 2000, max: 9000 },
    'RB': { min: 1500, max: 8500 },
    'WR': { min: 1500, max: 8500 },
    'TE': { min: 1000, max: 7500 },
    'K': { min: 500, max: 2000 },
    'DEF': { min: 800, max: 2500 }
  };
  
  const range = valueRanges[position as keyof typeof valueRanges] || { min: 500, max: 2000 };
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

function generateMockStats(position: string): PlayerStats {
  // Generate realistic stats based on position
  switch (position) {
    case 'QB':
      return {
        ppg: (15 + Math.random() * 15).toFixed(1), // 15-30 points per game
        yards: Math.floor(2000 + Math.random() * 3000), // 2000-5000 yards
        td: Math.floor(15 + Math.random() * 30), // 15-45 touchdowns
        snap_pct: Math.floor(80 + Math.random() * 20), // 80-100% of snaps
        rushing_att: Math.floor(10 + Math.random() * 90), // 10-100 rush attempts
        passing_yards: Math.floor(2000 + Math.random() * 3000), // 2000-5000 passing yards
        passing_td: Math.floor(15 + Math.random() * 25), // 15-40 passing TDs
        passing_int: Math.floor(1 + Math.random() * 15), // 1-16 interceptions
        rushing_yards: Math.floor(50 + Math.random() * 400), // 50-450 rushing yards
        rushing_td: Math.floor(0 + Math.random() * 6) // 0-6 rushing TDs
      };
    case 'RB':
      return {
        ppg: (10 + Math.random() * 15).toFixed(1), // 10-25 points per game
        yards: Math.floor(500 + Math.random() * 1500), // 500-2000 yards
        td: Math.floor(3 + Math.random() * 15), // 3-18 touchdowns
        snap_pct: Math.floor(40 + Math.random() * 50), // 40-90% of snaps
        rushing_att: Math.floor(100 + Math.random() * 200), // 100-300 rush attempts
        targets: Math.floor(20 + Math.random() * 60), // 20-80 targets
        receptions: Math.floor(15 + Math.random() * 50), // 15-65 receptions
        rushing_yards: Math.floor(400 + Math.random() * 1200), // 400-1600 rushing yards
        rushing_td: Math.floor(2 + Math.random() * 12), // 2-14 rushing TDs
        receiving_yards: Math.floor(100 + Math.random() * 500), // 100-600 receiving yards
        receiving_td: Math.floor(0 + Math.random() * 5) // 0-5 receiving TDs
      };
    case 'WR':
      return {
        ppg: (8 + Math.random() * 15).toFixed(1), // 8-23 points per game
        yards: Math.floor(400 + Math.random() * 1200), // 400-1600 yards
        td: Math.floor(2 + Math.random() * 10), // 2-12 touchdowns
        snap_pct: Math.floor(60 + Math.random() * 40), // 60-100% of snaps
        rushing_att: Math.floor(0 + Math.random() * 10), // 0-10 rush attempts
        targets: Math.floor(40 + Math.random() * 120), // 40-160 targets
        receptions: Math.floor(30 + Math.random() * 90), // 30-120 receptions
        rushing_yards: Math.floor(0 + Math.random() * 100), // 0-100 rushing yards
        rushing_td: Math.floor(0 + Math.random() * 2), // 0-2 rushing TDs
        receiving_yards: Math.floor(400 + Math.random() * 1200), // 400-1600 receiving yards
        receiving_td: Math.floor(2 + Math.random() * 10) // 2-12 receiving TDs
      };
    case 'TE':
      return {
        ppg: (5 + Math.random() * 10).toFixed(1), // 5-15 points per game
        yards: Math.floor(200 + Math.random() * 800), // 200-1000 yards
        td: Math.floor(1 + Math.random() * 8), // 1-9 touchdowns
        snap_pct: Math.floor(50 + Math.random() * 50), // 50-100% of snaps
        rushing_att: 0, // TEs rarely rush
        targets: Math.floor(30 + Math.random() * 80), // 30-110 targets
        receptions: Math.floor(20 + Math.random() * 60), // 20-80 receptions
        rushing_yards: 0,
        rushing_td: 0,
        receiving_yards: Math.floor(200 + Math.random() * 800), // 200-1000 receiving yards
        receiving_td: Math.floor(1 + Math.random() * 8) // 1-9 receiving TDs
      };
    default:
      return {
        ppg: (1 + Math.random() * 5).toFixed(1), // 1-6 points per game
        yards: 0,
        td: 0,
        snap_pct: 0,
        rushing_att: 0
      };
  }
} 