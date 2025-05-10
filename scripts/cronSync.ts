import pino from 'pino';
import { syncAll } from '../src/services/stats/index.js';
import 'dotenv/config';

const logger = pino({ name: 'cron-sync' });

const args = process.argv.slice(2);
const sourceArgIdx = args.findIndex((a) => a === '--source');
const sourceFilter = sourceArgIdx !== -1 ? args[sourceArgIdx + 1] : undefined;

(async () => {
  try {
    await syncAll({ sourceFilter });
    logger.info('Sync completed');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Sync failed');
    process.exit(1);
  }
})(); 