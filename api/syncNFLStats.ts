import { IncomingMessage, ServerResponse } from 'http';
import db from '../database/db';
import { fetchNFLPlayers } from '../utils/fetchNFL';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const players = await fetchNFLPlayers();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO players (id, name, position, team, value)
      VALUES (@id, @name, @position, @team, @value)
    `);

    const insertMany = db.transaction((players) => {
      for (const p of players) stmt.run(p);
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