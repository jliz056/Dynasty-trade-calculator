import { SleeperAdapter } from './adapters/SleeperAdapter.js';
import { FastRAdapter } from './adapters/FastRAdapter.js';
import pino from 'pino';

const logger = pino({ name: 'StatsIndex' });

type SyncAllOpts = { sourceFilter?: string } & { season?: number };

const adaptersMap = {
  sleeper: new SleeperAdapter(),
  fastr: new FastRAdapter(),
};

export async function syncAll(opts: SyncAllOpts = {}): Promise<void> {
  const { sourceFilter, ...rest } = opts;
  const entries = Object.entries(adaptersMap).filter(([key]) =>
    sourceFilter ? key === sourceFilter : true,
  );

  for (const [name, adapter] of entries) {
    try {
      logger.info({ name }, 'Syncing source');
      await adapter.sync(rest);
    } catch (err) {
      logger.error({ err }, `Sync failed for ${name}`);
    }
  }
}

export { adaptersMap }; 