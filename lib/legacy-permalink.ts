import { cache } from 'react';

import { DESK_SLUGS, articlePath, isContentError, isReservedTag } from '@mn/content';

import { repo } from './content';
import { logger } from './logger';
import { safeInternalPath } from './redirects';

/**
 * Where a WordPress URL went.
 *
 * The old site put almost everything in one flat namespace at the root.
 * `permalink_structure` is `/%postname%/`, so all 41.318 articles are indexed at
 * `/{slug}`; and `no-category-base-wpml` stripped the category base, so all 8.619
 * category archives are indexed at `/{slug}` too. Both land on `/[categoria]`, which
 * without this would answer 404 for every one of them.
 *
 * Two lookups, article first. A slug that is both an article and a category is
 * ambiguous on the old site as well, and the article is the more specific answer.
 *
 * The caller answers with `permanentRedirect`, which is a **308** — Next has no 301. For
 * a search engine the two are equivalent; the difference is that 308 preserves the
 * request method, which is inert on paths that only ever answer GET.
 *
 * **Why this is a lookup and not a table.** `data/legacy-redirects.json` is imported by
 * `middleware.ts`, which runs at the edge on every request. One entry per article is
 * about 5 MB of JSON in that bundle — parsed on every cold start, to encode a rule with
 * almost no exceptions in it: *the slug is the same, only the desk is new*. The table
 * keeps what is genuinely exceptional — redirects an editor entered in Kal El, an
 * operator CSV, the five posts whose slug changes under `slugify` — and the rule is
 * resolved here, once, against the CMS.
 *
 * `cache()` is what makes it once: `generateMetadata` and the page render concurrently
 * and would otherwise each ask.
 */
export const legacyPath = cache(async (slug: string): Promise<string | null> => {
  // A desk is a section, not a legacy permalink. Checking here rather than at the call
  // site means no caller can forget and turn `/filmes` into a redirect to itself.
  if (DESK_SLUGS.includes(slug)) return null;

  try {
    const article = await repo().getArticleBySlug(slug);
    // The article's own address — its editoria, or /ofertas for an offer page — never
    // the requested segment: this is the canonical URL.
    const path = article ? articlePath(article) : null;
    if (path) return validated(path);

    // Not an article. On the old site this segment could equally be a category archive,
    // and 8.613 of those categories are tags here — `/netflix` was 2.362 posts.
    // A reserved tag (`oferta`, `ao-vivo`…) has no archive: redirecting to it would end in 404.
    if (isReservedTag(slug)) return null;
    const tag = await repo().getTag(slug, 1);
    if (tag) return validated(`/tag/${tag.tag.slug}`);

    return null;
  } catch (err) {
    // A CMS outage must not turn a 404 into a 500, and must not be mistaken for "this
    // URL never existed" either — it is logged so a spike is visible.
    if (isContentError(err)) {
      logger.error('legacy.lookup_failed', { slug, kind: err.kind, correlationId: err.correlationId ?? null });
      return null;
    }
    throw err;
  }
});

/**
 * The destination, or nothing.
 *
 * The path is built from two CMS strings, and a slug that began with a slash or carried
 * one in the middle would make `permanentRedirect('//evil.example')` — an open redirect
 * with the CMS as the injection point. `safeInternalPath` is the same check the redirect
 * table goes through, applied for the same reason: a value that arrives from outside this
 * repository is data, however trustworthy its source is supposed to be.
 */
function validated(path: string): string | null {
  const safe = safeInternalPath(path);
  if (!safe) logger.error('legacy.unsafe_target', { path });
  return safe;
}
