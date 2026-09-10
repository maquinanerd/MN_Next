import type { ArticleLayout, ArticleSummary, Tag } from './domain/types';
import { OFFER_SEGMENT } from './site';

/**
 * Where an article lives. The one function every link, canonical, sitemap entry and
 * redirect goes through, so they can never disagree.
 *
 *  - an offer page lives at `/ofertas/{slug}` (kit docs/03), whatever its editoria;
 *  - everything else at `/{editoria}/{slug}`, the shape the archive already uses;
 *  - an article with no editoria has no public URL at all (null) — linking it would send
 *    `/{slug}` to the catch-all, which reads it as an editoria.
 */
export function articlePath(article: Pick<ArticleSummary, 'slug' | 'category' | 'layout'>): string | null {
  if (article.layout === 'offer') return `/${OFFER_SEGMENT}/${article.slug}`;
  return article.category ? `/${article.category.slug}/${article.slug}` : null;
}

/**
 * Reserved tag slugs that carry presentation intent the CMS has no column for.
 *
 * An editor picks the page composition from the tag picker; the tags never render. The
 * proposal to make this a real field is in `docs/migration/KAL-EL-DISCOVERY.md`.
 */
export const LAYOUT_TAGS: Record<Exclude<ArticleLayout, 'standard'>, readonly string[]> = {
  offer: ['oferta', 'ofertas', 'afiliado'],
  overlay: ['capa-em-tela-cheia'],
};

export function resolveLayout(tags: Pick<Tag, 'slug'>[]): ArticleLayout {
  const slugs = new Set(tags.map((t) => t.slug));
  if (LAYOUT_TAGS.offer.some((s) => slugs.has(s))) return 'offer';
  if (LAYOUT_TAGS.overlay.some((s) => slugs.has(s))) return 'overlay';
  return 'standard';
}

/** Reserved tags are editorial switches, not topics: they never appear as a filter or a link. */
export function isReservedTag(slug: string): boolean {
  return LAYOUT_TAGS.offer.includes(slug) || LAYOUT_TAGS.overlay.includes(slug) || RESERVED_FLAG_TAGS.has(slug);
}

const RESERVED_FLAG_TAGS = new Set(['longform', 'ao-vivo', 'patrocinado', 'review-amostra', 'campanha']);
