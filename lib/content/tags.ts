import 'server-only';
import { isContentError, type ArticleSummary, type Page } from '@mn/content';

import { logger } from '../logger';
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

/** Hubs read at a time: each read is a tag lookup, a listing and its taxonomy context. */
const HUB_READS = 4;

/**
 * The tags the sitemap lists: the editorias' subject hubs (`hubTagSlugs`) that exist and are
 * indexable. A couple of dozen reads, four at a time, each one the page's own cached first
 * page — not a walk through every tag in the CMS.
 *
 * A hub the CMS fails to answer for is left out and logged, and the result says `degraded`
 * so the file is cached briefly: one flaky read must not turn the whole sitemap into a 500.
 * Only an outage, as in `discovery()`: a contract violation or a bug of our own is thrown,
 * because an empty file served with a 200 would hide it.
 */
export async function indexableHubTags(): Promise<{ slugs: string[]; degraded: boolean }> {
  const hubs = [...hubTagSlugs()];
  const slugs: string[] = [];
  let degraded = false;
  for (let i = 0; i < hubs.length; i += HUB_READS) {
    const batch = hubs.slice(i, i + HUB_READS);
    const settled = await Promise.allSettled(batch.map((slug) => repo().getTag(slug, 1)));
    settled.forEach((result, j) => {
      if (result.status === 'rejected') {
        if (!isContentError(result.reason) || result.reason.kind !== 'unavailable') throw result.reason;
        degraded = true;
        logger.warn('sitemap.hub-failed', { tag: batch[j] ?? '', error: String(result.reason) });
        return;
      }
      const page = result.value;
      if (page && tagArticleCount(page) >= MIN_INDEXABLE_TAG) slugs.push(page.tag.slug);
    });
  }
  return { slugs, degraded };
}
