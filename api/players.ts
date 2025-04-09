import { IncomingMessage, ServerResponse } from 'http';
import db from '../database/db';

interface DbPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  age: number;
  experience: number;
  ppg: number | null;
  yards: number | null;
  td: number | null;
  snap_pct: number | null;
  rushing_att: number | null;
  targets: number | null;
  receptions: number | null;
  passing_yards: number | null;
  passing_td: number | null;
  passing_int: number | null;
  rushing_yards: number | null;
  rushing_td: number | null;
  receiving_yards: number | null;
  receiving_td: number | null;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Join players with player_stats to get all data in one query
    const players = db.prepare(`
      SELECT 
        p.id, p.name, p.position, p.team, p.value, p.age, p.experience,
        s.ppg, s.yards, s.td, s.snap_pct, s.rushing_att, s.targets, s.receptions,
        s.passing_yards, s.passing_td, s.passing_int, s.rushing_yards, s.rushing_td,
        s.receiving_yards, s.receiving_td
      FROM players p
      LEFT JOIN player_stats s ON p.id = s.player_id
    `).all() as DbPlayer[];
    
    // Transform the flat data into a nested structure
    const transformedPlayers = players.map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      value: player.value,
      age: player.age,
      experience: player.experience,
      stats: {
        position: player.position,
        ppg: player.ppg || 0,
        yards: player.yards || 0,
        td: player.td || 0,
        snap_pct: player.snap_pct || 0,
        rushing_att: player.rushing_att || 0,
        targets: player.targets || 0,
        receptions: player.receptions || 0,
        passing: {
          yards: player.passing_yards || 0,
          touchdowns: player.passing_td || 0,
          interceptions: player.passing_int || 0
        },
        rushing: {
          yards: player.rushing_yards || 0,
          touchdowns: player.rushing_td || 0
        },
        receiving: {
          yards: player.receiving_yards || 0,
          touchdowns: player.receiving_td || 0
        }
      }
    }));
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(transformedPlayers));
  } catch (error) {
    console.error('Error fetching players:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to fetch players' }));
  }
} 