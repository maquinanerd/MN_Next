import { newsSitemap } from '@mn/seo';

import { discovery, discoveryCacheControl, repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Google News sitemap: last 48 hours, at most 1000 URLs, revalidated every 5 minutes.
 *
 * The window is enforced twice - the query asks for recent items, and `newsSitemap()`
 * filters again - because a stale cache entry serving day-old "news" is worse than an
 * empty file.
 *
 * A CMS outage degrades this file rather than failing the render. It is prerendered at
 * build time, so throwing here means the site cannot be deployed while the CMS is
 * unreachable — the moment a deploy is most likely to be needed.
 */
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const { items, degraded } = await discovery(repo().listRecentNews(since, 1000), 'news-sitemap');
  const body = newsSitemap(seoContext(), items);
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': discoveryCacheControl(degraded, 300),
    },
  });
}
