import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.resolve(__dirname, 'nfl.db'));

// Create tables if they don't exist
const playerSchema = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT,
  position TEXT,
  team TEXT,
  value REAL,
  age INTEGER DEFAULT 0,
  experience INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;

const statsSchema = `
CREATE TABLE IF NOT EXISTS player_stats (
  player_id TEXT PRIMARY KEY,
  ppg REAL DEFAULT 0,
  yards INTEGER DEFAULT 0,
  td INTEGER DEFAULT 0,
  snap_pct REAL DEFAULT 0,
  rushing_att INTEGER DEFAULT 0,
  targets INTEGER DEFAULT 0,
  receptions INTEGER DEFAULT 0,
  passing_yards INTEGER DEFAULT 0,
  passing_td INTEGER DEFAULT 0,
  passing_int INTEGER DEFAULT 0,
  rushing_yards INTEGER DEFAULT 0,
  rushing_td INTEGER DEFAULT 0,
  receiving_yards INTEGER DEFAULT 0,
  receiving_td INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);`;

db.exec(playerSchema);
db.exec(statsSchema);

export default db; 