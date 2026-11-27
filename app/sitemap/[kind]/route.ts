import { notFound } from 'next/navigation';
import type { SitemapKind } from '@mn/content';
import { urlSet } from '@mn/seo';

import { discoveryCacheControl, isContentError, repo } from '../../../lib/content';
import { indexableHubTags } from '../../../lib/content/tags';
import { logger } from '../../../lib/logger';
import { seoContext } from '../../../lib/seo-context';
import { freshSeconds, sitemapFiles, sitemapKey, sitemapPolicy, type SitemapFile } from '../../../lib/sitemap-cache';

/**
 * Child sitemaps, named by the index at `/sitemap.xml`.
 *
 * Article files carry their page number in the filename (`articles-1.xml`,
 * `articles-2.xml`, …) so the index can enumerate them. Taxonomy files are single files.
 * The tag file lists the editorias' subject hubs only, and only those indexable
 * (`indexableHubTags`): the archive brought 37.150 tags, most on one or two stories, and a
 * tag page under the threshold is `noindex` — it must not be submitted as well.
 *
 * Every file is answered from `lib/sitemap-cache.ts`: rendered once, served from memory,
 * refreshed behind the answer, and kept when the CMS fails. Rendered per request, as it was,
 * an article file cost fifty CMS reads every time Googlebot asked for it, and one slow read
 * turned the whole file into a 500 (2026-11-27, `articles-2.xml`, after 29.6 s). With no copy
 * to fall back on, an outage is a 503 with `Retry-After` — "come back", not "broken".
 */

// No `revalidate` and no `generateStaticParams`: the route renders per request, and the
// cache is `sitemapFiles`. Next's ISR would put these files in the page LRU (see above).

const SIMPLE_KINDS = new Set<SitemapKind>(['categories', 'tags', 'authors']);

/** `articles-3` -> page 3; `categories` -> a single taxonomy file. */
function parseKind(raw: string): { kind: SitemapKind; page: number } | null {
  const name = raw.replace(/\.xml$/i, '');
  const articles = /^articles-(\d{1,4})$/.exec(name);
  if (articles) return { kind: 'articles', page: Number(articles[1]) };
  if (name === 'articles') return { kind: 'articles', page: 1 };
  if (SIMPLE_KINDS.has(name as SitemapKind)) return { kind: name as SitemapKind, page: 1 };
  return null;
}

export async function GET(_request: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const { kind: raw } = await ctx.params;
  const parsed = parseKind(raw);
  if (!parsed || parsed.page < 1) notFound();
  const { kind, page } = parsed;
  const key = sitemapKey(kind, page);

  let file: SitemapFile | null;
  let state: string;
  try {
    ({ value: file, state } = await sitemapFiles.get(key, () => render(kind, page), sitemapPolicy(kind, page)));
  } catch (err) {
    if (!isContentError(err) || err.kind !== 'unavailable') throw err;
    logger.error('discovery.unavailable', { label: `sitemap-${key}`, correlationId: err.correlationId ?? null });
    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: { 'retry-after': '120', 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // A page past the end is a 404, not an empty file a crawler would keep re-fetching.
  if (!file) notFound();

  return new Response(file.body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // An hour (ten minutes for the newest file); a minute while degraded (`discovery`).
      'cache-control': discoveryCacheControl(file.degraded, freshSeconds(kind, page)),
      'x-sitemap-cache': state,
    },
  });
}

/** One file, from the CMS. Null for an article page past the end. */
async function render(kind: SitemapKind, page: number): Promise<SitemapFile | null> {
  if (kind === 'tags') {
    const { slugs, degraded } = await indexableHubTags();
    const entries = slugs.map((slug) => ({ path: `/tag/${slug}` }));
    return { body: urlSet(seoContext(), entries), entries: entries.length, degraded };
  }

  const listed = await repo().listSitemap(kind, String(page));
  if (kind === 'articles' && listed.entries.length === 0 && page > 1) return null;
  return { body: urlSet(seoContext(), listed.entries), entries: listed.entries.length, degraded: false };
}
