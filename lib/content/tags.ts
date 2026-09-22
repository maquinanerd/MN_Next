import 'server-only';
import type { ArticleSummary, Page } from '@mn/content';

import { hubTagSlugs } from './editorias';
import { repo } from './repo';

/**
 * When a tag archive is worth an index entry.
 *
 * The archive brought 37.150 tags, most of them on one or two articles, and a page that
 * lists one story is a thin page in the index. Below this count a tag is `noindex, follow`:
 * navigable, its links still counted. The tag sitemap applies the same rule, so no URL is
 * both submitted and excluded.
 */
export const MIN_INDEXABLE_TAG = 5;

/** How many articles a tag holds, from its first page: exact when the CMS counts them. */
export function tagArticleCount(first: Page<ArticleSummary>): number {
  // Without a count, a first page that is also the last one holds them all.
  return first.total ?? (first.hasNext ? Number.POSITIVE_INFINITY : first.items.length);
}

/**
 * The tags the sitemap lists: the editorias' subject hubs (`hubTagSlugs`) that exist and are
 * indexable. A couple of dozen reads, each one the page's own cached first page — not a walk
 * through every tag in the CMS.
 */
export async function indexableHubTags(): Promise<string[]> {
  const pages = await Promise.all([...hubTagSlugs()].map((slug) => repo().getTag(slug, 1)));
  return pages
    .filter((p): p is NonNullable<typeof p> => p !== null && tagArticleCount(p) >= MIN_INDEXABLE_TAG)
    .map((p) => p.tag.slug);
}
