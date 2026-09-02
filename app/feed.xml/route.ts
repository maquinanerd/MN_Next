import { TAG } from '@mn/content';
import { rssFeed } from '@mn/seo';

import { discovery, discoveryCacheControl, repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * RSS: the 30 most recent items, refreshed every 15 minutes (docs/06).
 *
 * Degrades to an empty-but-valid feed if the CMS is unreachable, for the same reason the
 * news sitemap does: this route is prerendered, so an exception here fails the build.
 */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { items, degraded } = await discovery(repo().listRecentNews(since, 30), 'feed');
  const body = rssFeed(seoContext(), items);
  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': discoveryCacheControl(degraded, 900),
      'x-cache-tag': TAG.news,
    },
  });
}
