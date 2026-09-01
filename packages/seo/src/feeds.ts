import type { ArticleSummary, SitemapEntry } from '@mn/content';
import { escapeHtml } from '@mn/content';

import { absolute, articleUrl, type SeoContext } from './graph';

/**
 * XML generators for RSS, the sitemap family and the Google News sitemap.
 *
 * Text is escaped rather than wrapped in CDATA: a title containing `]]>` breaks a CDATA
 * section, and escaping has no such edge case.
 */

function xmlDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function rfc822(iso: string): string {
  const date = new Date(iso);
  return (Number.isNaN(date.getTime()) ? new Date() : date).toUTCString();
}

export function rssFeed(ctx: SeoContext, items: ArticleSummary[]): string {
  const entries = items
    .slice(0, 30)
    .map((item) => {
      const url = articleUrl(ctx, item);
      return [
        '    <item>',
        `      <title>${escapeHtml(item.title)}</title>`,
        `      <link>${escapeHtml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeHtml(url)}</guid>`,
        `      <pubDate>${rfc822(item.publishedAt ?? item.updatedAt)}</pubDate>`,
        `      <description>${escapeHtml(item.excerpt)}</description>`,
        item.category ? `      <category>${escapeHtml(item.category.name)}</category>` : '',
        item.authors[0] ? `      <dc:creator>${escapeHtml(item.authors[0].name)}</dc:creator>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeHtml(ctx.siteName)}</title>`,
    `    <link>${escapeHtml(ctx.siteUrl)}/</link>`,
    '    <description>Cinema, séries, quadrinhos, games e animes.</description>',
    '    <language>pt-BR</language>',
    `    <lastBuildDate>${rfc822(items[0]?.updatedAt ?? new Date().toISOString())}</lastBuildDate>`,
    `    <atom:link href="${escapeHtml(ctx.siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />`,
    entries,
    '  </channel>',
    '</rss>',
  ].join('\n');
}

export function sitemapIndex(ctx: SeoContext, paths: string[]): string {
  const now = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((p) => `  <sitemap><loc>${escapeHtml(absolute(ctx, p))}</loc><lastmod>${now}</lastmod></sitemap>`),
    '</sitemapindex>',
  ].join('\n');
}

export function urlSet(ctx: SeoContext, entries: SitemapEntry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) =>
        `  <url><loc>${escapeHtml(absolute(ctx, e.path))}</loc><lastmod>${xmlDate(e.lastModified)}</lastmod></url>`,
    ),
    '</urlset>',
  ].join('\n');
}

/**
 * Google News sitemap: the last 48 hours only, at most 1000 URLs.
 *
 * Anything older is not "news" to the crawler, and an oversized file is rejected
 * outright - so both limits are enforced here rather than trusted upstream.
 */
export function newsSitemap(ctx: SeoContext, items: ArticleSummary[], now = new Date()): string {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  const fresh = items
    .filter((item) => {
      const published = Date.parse(item.publishedAt ?? '');
      return Number.isFinite(published) && published >= cutoff;
    })
    .slice(0, 1000);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...fresh.map((item) =>
      [
        '  <url>',
        `    <loc>${escapeHtml(articleUrl(ctx, item))}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        `        <news:name>${escapeHtml(ctx.siteName)}</news:name>`,
        '        <news:language>pt</news:language>',
        '      </news:publication>',
        `      <news:publication_date>${xmlDate(item.publishedAt ?? item.updatedAt)}</news:publication_date>`,
        `      <news:title>${escapeHtml(item.title)}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
  ].join('\n');
}
