import { sitemapIndex } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Sitemap index.
 *
 * It must name **every** child file. An earlier version listed a single
 * `/sitemap/articles.xml` and relied on an HTTP `Link: rel="next"` header to continue —
 * which no crawler follows for sitemaps, so only the first page of the archive was ever
 * discoverable. The article count now decides how many numbered files to declare.
 *
 * A CMS outage degrades to the taxonomy sitemaps plus one article page rather than a
 * 500: a partial index is still crawlable, an error is not.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const ctx = seoContext();

  let articlePages = 1;
  try {
    articlePages = await repo().countSitemapPages();
  } catch {
    articlePages = 1;
  }

  const paths = [
    ...Array.from({ length: articlePages }, (_, i) => `/sitemap/articles-${i + 1}.xml`),
    '/sitemap/categories.xml',
    '/sitemap/tags.xml',
    '/sitemap/authors.xml',
    '/news-sitemap.xml',
  ];

  return new Response(sitemapIndex(ctx, paths), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
