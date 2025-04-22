import axios from 'axios';
// eslint-disable-next-line import/no-relative-parent-imports
import { supabase } from '../../../../';
import pino from 'pino';
import { IStatsProvider } from '../IStatsProvider.js';
import { PlayerDoc } from '../types.js';
import { upsertPlayers } from '../datastore.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';

const logger = pino({ name: 'SleeperAdapter' });
const BASE_URL = 'https://api.sleeper.app/v1';
const RATE_LIMIT_DELAY_MS = 500; // per spec 500ms between calls

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SleeperAdapter implements IStatsProvider {
  async sync(opts: { upload?: boolean; noFetch?: boolean } = {}): Promise<void> {
    logger.info('Starting Sleeper sync');
    let playersArray: any[] = [];

    if (opts.noFetch) {
      const fileBuf = await readFile('data/sleeper_players.json');
      playersArray = JSON.parse(fileBuf.toString());
      logger.info(`Loaded ${playersArray.length} players from local JSON`);
    } else {
      const playersResp = await axios.get<Record<string, any>>(`${BASE_URL}/players/nfl`);
      playersArray = Object.values(playersResp.data);
      logger.info(`Fetched ${playersArray.length} players from Sleeper`);
    }

    // Fetch dynasty ADP for current season
    const season = new Date().getFullYear();
    await sleep(RATE_LIMIT_DELAY_MS);
    let adpMap: Record<string, number> = {};
    try {
      const adpResp = await axios.get<any[]>(`${BASE_URL}/adp/nfl/dynasty?season=${season}`);
      for (const row of adpResp.data) {
        adpMap[row.player_id] = Number(row.adp ?? row.average ?? row.adp_half ?? 0);
      }
      logger.info(`Fetched ADP for ${Object.keys(adpMap).length} players`);
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch dynasty ADP – continuing');
    }

    if (Object.keys(adpMap).length === 0) {
      try {
        const lastYear = season - 1;
        const adpResp = await axios.get<any[]>(
          `${BASE_URL}/adp/nfl/dynasty?season=${lastYear}`,
        );
        adpResp.data.forEach(r => (adpMap[r.player_id] = Number(r.adp ?? 0)));
        logger.info(`Fetched fallback ADP for season ${lastYear}`);
      } catch { /* ignore */ }
    }

    const docs: PlayerDoc[] = playersArray.map((pl: any) => ({
      playerId: pl.player_id,
      firstName: pl.first_name ?? undefined,
      lastName: pl.last_name ?? undefined,
      position: pl.position,
      team: pl.team,
      college: pl.college,
      draftYear: pl.draft_year ? Number(pl.draft_year) : undefined,
      draftPick: pl.draft_pick ? Number(pl.draft_pick) : undefined,
      dynastyADP: adpMap[pl.player_id],
      injuryStatus: pl.injury_status ?? null,
    }));

    // persist to file first
    await mkdir('data', { recursive: true });
    await writeFile('data/sleeper_players.json', JSON.stringify(docs, null, 2));
    logger.info(`Wrote data/sleeper_players.json (${docs.length} players)`);

    if (opts.upload !== false) {
      await upsertPlayers(docs);
    }

    logger.info('Sleeper sync finished');
  }

  async getPlayer(id: string): Promise<PlayerDoc | null> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('playerId', id)
      .single();
    if (error) {
      logger.error({ error }, 'Error fetching player');
      return null;
    }
    return data as PlayerDoc;
  }
} 