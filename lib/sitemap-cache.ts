import 'server-only';

import { logger } from './logger';
import { createStaleCache } from './stale-cache';

/** One child sitemap, rendered. `degraded` when the CMS failed some of the reads behind it. */
export interface SitemapFile {
  body: string;
  degraded: boolean;
}

/**
 * The child sitemaps, kept in memory by `app/sitemap/[kind]/route.ts` (see `lib/stale-cache.ts`).
 *
 * Thirty-two files is room for every article file the archive needs today (nine, at 5 000
 * stories each) and the three taxonomy files, with slack for growth; a file is under a
 * megabyte. A stale file is served while it refreshes for up to a day — long past any
 * outage worth waiting out, and far less than the time Google keeps a sitemap it has read.
 */
export const sitemapFiles = createStaleCache<SitemapFile | null>({
  maxEntries: 32,
  staleWhileRevalidateMs: 24 * 60 * 60 * 1000,
  retryAfterFailureMs: 60 * 1000,
  onBackgroundError: (key, err) => {
    logger.warn('sitemap.refresh-failed', { file: key, error: String(err) });
  },
});
