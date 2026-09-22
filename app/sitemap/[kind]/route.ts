import { notFound } from 'next/navigation';
import type { SitemapKind } from '@mn/content';
import { urlSet } from '@mn/seo';

import { repo } from '../../../lib/content';
import { indexableHubTags } from '../../../lib/content/tags';
import { seoContext } from '../../../lib/seo-context';

/**
 * Child sitemaps, named by the index at `/sitemap.xml`.
 *
 * Article files carry their page number in the filename (`articles-1.xml`,
 * `articles-2.xml`, …) so the index can enumerate them. Taxonomy files are single files.
 * The tag file lists the editorias' subject hubs only, and only those indexable
 * (`indexableHubTags`): the archive brought 37.150 tags, most on one or two stories, and a
 * tag page under the threshold is `noindex` — it must not be submitted as well.
 */
export const revalidate = 3600;

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

  if (parsed.kind === 'tags') {
    const hubs = await indexableHubTags();
    return xml(
      urlSet(
        seoContext(),
        hubs.map((slug) => ({ path: `/tag/${slug}` })),
      ),
    );
  }

  const page = await repo().listSitemap(parsed.kind, String(parsed.page));
  // A page past the end is a 404, not an empty file a crawler would keep re-fetching.
  if (parsed.kind === 'articles' && page.entries.length === 0 && parsed.page > 1) notFound();

  return xml(urlSet(seoContext(), page.entries));
}

function xml(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
