import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/seo-context';

/**
 * robots.txt.
 *
 * `/_next/image` and `/_next/static` stay crawlable - blocking them is a classic way to
 * make Google render the site without its own images and CSS (docs/06 checklist).
 *
 * A non-production host disallows everything: a staging deployment that gets indexed
 * competes with the real site for its own content.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const isProduction =
    process.env.NODE_ENV === 'production' && !/localhost|127\.0\.0\.1|staging|preview|vercel\.app/i.test(base);

  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: base,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/_next/image', '/_next/static'],
        disallow: ['/api/', '/preview/', '/busca', '/media/'],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}
