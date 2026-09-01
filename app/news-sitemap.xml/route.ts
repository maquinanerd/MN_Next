import { newsSitemap } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Google News sitemap: last 48 hours, at most 1000 URLs, revalidated every 5 minutes.
 *
 * The window is enforced twice - the query asks for recent items, and `newsSitemap()`
 * filters again - because a stale cache entry serving day-old "news" is worse than an
 * empty file.
 */
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const items = await repo().listRecentNews(since, 1000);
  const body = newsSitemap(seoContext(), items);
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
