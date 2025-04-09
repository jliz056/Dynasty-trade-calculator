import { IncomingMessage, ServerResponse } from 'http';
import db from '../database/db';
import { fetchNFLPlayers } from '../utils/fetchNFL';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const players = await fetchNFLPlayers();

    // Prepare statements for player and player_stats tables
    const playerStmt = db.prepare(`
      INSERT OR REPLACE INTO players (id, name, position, team, value, age, experience)
      VALUES (@id, @name, @position, @team, @value, @age, @experience)
    `);

    const statsStmt = db.prepare(`
      INSERT OR REPLACE INTO player_stats (
        player_id, ppg, yards, td, snap_pct, rushing_att, targets, receptions,
        passing_yards, passing_td, passing_int, rushing_yards, rushing_td,
        receiving_yards, receiving_td
      ) VALUES (
        @id, @ppg, @yards, @td, @snap_pct, @rushing_att, @targets, @receptions,
        @passing_yards, @passing_td, @passing_int, @rushing_yards, @rushing_td,
        @receiving_yards, @receiving_td
      )
    `);

    // Transaction to insert both player data and stats
    const insertMany = db.transaction((players) => {
      for (const player of players) {
        // Insert player basic info
        playerStmt.run({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          value: player.value,
          age: player.age,
          experience: player.experience
        });

        // Insert player stats
        statsStmt.run({
          id: player.id,
          ppg: player.stats.ppg,
          yards: player.stats.yards,
          td: player.stats.td,
          snap_pct: player.stats.snap_pct,
          rushing_att: player.stats.rushing_att,
          targets: player.stats.targets || 0,
          receptions: player.stats.receptions || 0,
          passing_yards: player.stats.passing_yards || 0,
          passing_td: player.stats.passing_td || 0,
          passing_int: player.stats.passing_int || 0,
          rushing_yards: player.stats.rushing_yards || 0,
          rushing_td: player.stats.rushing_td || 0,
          receiving_yards: player.stats.receiving_yards || 0,
          receiving_td: player.stats.receiving_td || 0
        });
      }
    });

    insertMany(players);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, count: players.length }));
  } catch (error) {
    console.error('Error syncing NFL stats:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Failed to sync NFL stats' }));
  }
} 