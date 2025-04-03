import { IncomingMessage, ServerResponse } from 'http';
import db from '../database/db';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const players = db.prepare('SELECT * FROM players').all();
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(players));
  } catch (error) {
    console.error('Error fetching players:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to fetch players' }));
  }
} 