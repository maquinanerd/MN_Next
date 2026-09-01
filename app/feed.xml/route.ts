import { TAG } from '@mn/content';
import { rssFeed } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/** RSS: the 30 most recent items, refreshed every 15 minutes (docs/06). */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const items = await repo().listRecentNews(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 30);
  const body = rssFeed(seoContext(), items);
  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, s-maxage=900, stale-while-revalidate=1800',
      'x-cache-tag': TAG.news,
    },
  });
}
