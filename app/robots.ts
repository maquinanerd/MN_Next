import type { MetadataRoute } from 'next';

import { siteUrl } from '../lib/seo-context';

/**
 * robots.txt.
 *
 * `/_next/image` and `/_next/static` stay crawlable - blocking them is a classic way to
 * make Google render the site without its own images and CSS (docs/06 checklist).
 *
 * A non-production deployment disallows everything: a staging deployment that gets
 * indexed competes with the real site for its own content.
 *
 * The deciding signal is `APP_ENV`, not `NODE_ENV` — a staging build *is* a production
 * build, so `NODE_ENV` reads "production" there too. The hostname patterns stay as a
 * second net for a deployment that forgot to set `APP_ENV`, but they cannot be the
 * primary test: a staging host named `homolog.` or `hml.` matches none of them and
 * would have been handed a fully crawlable robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV;
  const isProduction =
    appEnv === 'production' && !/localhost|127\.0\.0\.1|staging|preview|homolog|hml\.|vercel\.app/i.test(base);

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
