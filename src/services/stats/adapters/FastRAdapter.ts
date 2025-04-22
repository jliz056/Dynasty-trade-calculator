import axios from 'axios';
import csvParser from 'csv-parser';
import pino from 'pino';
import { IStatsProvider } from '../IStatsProvider.js';
import { SeasonStat } from '../types.js';
import { upsertSeasonStats } from '../datastore.js';

type SyncOpts = { season?: number };

const logger = pino({ name: 'FastRAdapter' });

export class FastRAdapter implements IStatsProvider {
  async sync(opts?: SyncOpts): Promise<void> {
    const season = opts?.season ?? new Date().getFullYear() - 1; // default previous season

    logger.info({ season }, 'Starting FastR sync');

    const url = `https://raw.githubusercontent.com/nflverse/nflfastR-data/master/data/stats/basic/${season}_basic.csv`;

    const response = await axios.get(url, { responseType: 'stream' });

    const stats: SeasonStat[] = [];

    await new Promise<void>((resolve, reject) => {
      response.data
        .pipe(csvParser())
        .on('data', (row: any) => {
          // row contains columns like player_id, g, fantasy_points_ppr
          if (!row.player_id) return;
          const rec: SeasonStat = {
            playerId: row.player_id,
            season,
            games: Number(row.g || 0),
            pprPoints: Number(row.fantasy_points_ppr || row.fantasy_points || 0),
          };
          stats.push(rec);
        })
        .on('end', () => resolve())
        .on('error', (err: any) => reject(err));
    });

    logger.info(`Parsed ${stats.length} season stats rows`);
    await upsertSeasonStats(stats);
    logger.info('FastR sync finished');
  }

  async getPlayer(id: string): Promise<any | null> {
    // not implemented for fastR
    return null;
  }
} 