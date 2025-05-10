export interface IStatsProvider {
  /** Pulls fresh data and writes/updates DB. */
  sync(opts?: { season?: number; week?: number; upload?: boolean; noFetch?: boolean }): Promise<void>;

  /** Direct lookup helper used by backend routes (optional shortcut). */
  getPlayer(id: string): Promise<any | null>;
} 