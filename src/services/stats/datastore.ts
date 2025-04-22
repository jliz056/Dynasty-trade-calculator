import pino from 'pino';
import { supabase } from '../../../supabaseClient.js';
import { PlayerDoc, SeasonStat } from './types';
import { camelCase, snakeCase } from 'change-case';

const logger = pino({ name: 'DataStore' });

function toSnakeKeys<T extends Record<string, any>>(obj: T): any {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeCase(k)] = v;
  }
  return out;
}

export async function upsertPlayers(players: PlayerDoc[]): Promise<void> {
  if (!players.length) return;
  const rows = players.map(toSnakeKeys);
  const { error } = await supabase
    .from('players')
    .upsert(rows, { onConflict: 'player_id' });
  if (error) {
    logger.error({ error }, 'Failed to upsert players');
    throw error;
  }
  logger.info(`Upserted ${players.length} players`);
}

export async function upsertSeasonStats(stats: SeasonStat[]): Promise<void> {
  if (!stats.length) return;
  const rows = stats.map(toSnakeKeys);
  const { error } = await supabase
    .from('season_stats')
    .upsert(rows, { onConflict: 'player_id,season' });
  if (error) {
    logger.error({ error }, 'Failed to upsert season stats');
    throw error;
  }
  logger.info(`Upserted ${stats.length} season stat rows`);
} 