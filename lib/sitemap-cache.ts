import 'server-only';

import type { SitemapKind } from '@mn/content';

import { logger } from './logger';
import { createStaleCache, type StorePolicy } from './stale-cache';

const HOUR_MS = 60 * 60 * 1000;

/** One child sitemap, rendered. `degraded` when the CMS failed some of the reads behind it. */
export interface SitemapFile {
  body: string;
  /** URLs in it. */
  entries: number;
  degraded: boolean;
}

/**
 * The child sitemaps, kept in memory by `app/sitemap/[kind]/route.ts` (see `lib/stale-cache.ts`).
 *
 * Thirty-two files is room for every article file the archive needs today (nine, at 5 000
 * stories each) and the three taxonomy files, with slack for growth; a file is under a
 * megabyte.
 */
export const sitemapFiles = createStaleCache<SitemapFile | null>({
  maxEntries: 32,
  staleWhileRevalidateMs: 23 * HOUR_MS,
  retryAfterFailureMs: 60 * 1000,
  onBackgroundError: (key, err) => {
    logger.warn('sitemap.refresh-failed', { file: key, error: String(err) });
  },
});

/** The file each new story lands in: the article sitemaps list the newest first. */
export const NEWEST_ARTICLES = 'articles-1';

export function sitemapKey(kind: SitemapKind, page: number): string {
  return `${kind}-${page}`;
}

/** Seconds a file is fresh: ten minutes for the newest article file, an hour for the rest. */
export function freshSeconds(kind: SitemapKind, page: number): number {
  return sitemapKey(kind, page) === NEWEST_ARTICLES ? 600 : 3600;
}

/** A degraded file — the CMS failed some of its reads — is fresh for a minute, not an hour. */
const DEGRADED_SECONDS = 60;

/**
 * How long a file is kept, and when a new rendering does not replace the one held.
 *
 * - **Fresh** for `freshSeconds`; a degraded one for a minute.
 * - **Served stale while it refreshes**: the newest article file for 50 more minutes, so it
 *   is never more than an hour old while the CMS answers — the window its `revalidate` declared, and the news
 *   sitemap carries the last 48 hours every 5 minutes besides. Every other file holds
 *   stories two months old and more, which change only at the edges as new ones push them
 *   along; it is served stale for up to 23 more hours. Past that a request waits for the
 *   refresh — and still gets the old file if the refresh fails.
 * - **Not replaced by a worse one**: a degraded rendering (an outage left hubs out of the tag
 *   file), an article page that came back past the end, or a file that came back with no URL
 *   where the one held had some, does not take the place of a whole file; the whole one stays
 *   and the refresh is tried again after the pause.
 */
export function sitemapPolicy(kind: SitemapKind, page: number): StorePolicy<SitemapFile | null> {
  const newest = sitemapKey(kind, page) === NEWEST_ARTICLES;
  return {
    freshFor: (file) => (file?.degraded ? DEGRADED_SECONDS : freshSeconds(kind, page)) * 1000,
    staleFor: () => (newest ? 50 * 60 * 1000 : 23 * HOUR_MS),
    keep: (file) => file !== null,
    worseThan: (next, held) =>
      held !== null && !held.degraded && (next === null || next.degraded || (next.entries === 0 && held.entries > 0)),
  };
}

/**
 * A story was published or changed (`/api/revalidate`): the newest article file stops being
 * fresh, so its next request — answered from the copy at once — renders it again behind the
 * answer. Cache tags do not reach this cache, so the webhook says it here.
 *
 * Not rendered from the webhook itself: Next applies the `revalidateTag` purge only after the
 * handler returns, so a render started there would read the CMS lists from the data cache as
 * they were before the story. The next request comes after the purge.
 */
export function markNewestArticlesStale(): void {
  sitemapFiles.markStale(NEWEST_ARTICLES);
}
