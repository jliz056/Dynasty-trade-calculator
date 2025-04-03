import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.resolve(__dirname, 'nfl.db'));

// Create table if it doesn't exist
const schema = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT,
  position TEXT,
  team TEXT,
  value REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;

db.exec(schema);

export default db; 