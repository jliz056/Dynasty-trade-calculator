import axios from 'axios';
import db from '../../database/db';
import dotenv from 'dotenv';

dotenv.config();

const SLEEPER_API_URL = 'https://api.sleeper.app/v1/players/nfl'; // Replace with actual endpoint

// Define a type for the player stats
interface PlayerStats {
  player_id: string;
  ppg: number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
  targets: number;
  receptions: number;
  passing_yards: number;
  passing_td: number;
  passing_int: number;
  rushing_yards: number;
  rushing_td: number;
  receiving_yards: number;
  receiving_td: number;
}

async function fetchSleeperData() {
  try {
    const response = await axios.get(SLEEPER_API_URL);
    const playerStats = response.data as PlayerStats[]; // Cast response data to PlayerStats[] type
    insertPlayerStatsIntoDB(playerStats);
  } catch (error) {
    console.error('Error fetching Sleeper data:', error);
  }
}

function insertPlayerStatsIntoDB(playerStats: PlayerStats[]) {
  const insertStats = db.prepare(`
    INSERT INTO player_stats (player_id, ppg, yards, td, snap_pct, rushing_att, targets, receptions, passing_yards, passing_td, passing_int, rushing_yards, rushing_td, receiving_yards, receiving_td)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      ppg=excluded.ppg,
      yards=excluded.yards,
      td=excluded.td,
      snap_pct=excluded.snap_pct,
      rushing_att=excluded.rushing_att,
      targets=excluded.targets,
      receptions=excluded.receptions,
      passing_yards=excluded.passing_yards,
      passing_td=excluded.passing_td,
      passing_int=excluded.passing_int,
      rushing_yards=excluded.rushing_yards,
      rushing_td=excluded.rushing_td,
      receiving_yards=excluded.receiving_yards,
      receiving_td=excluded.receiving_td;
  `);

  playerStats.forEach((stats: PlayerStats) => {
    insertStats.run(
      stats.player_id,
      stats.ppg,
      stats.yards,
      stats.td,
      stats.snap_pct,
      stats.rushing_att,
      stats.targets,
      stats.receptions,
      stats.passing_yards,
      stats.passing_td,
      stats.passing_int,
      stats.rushing_yards,
      stats.rushing_td,
      stats.receiving_yards,
      stats.receiving_td
    );
  });
}

fetchSleeperData(); 