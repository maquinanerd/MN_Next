import Link from 'next/link';
import type { ArticleSummary } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { AuthorByline } from './AuthorByline';
import { PlayIcon } from '../primitives/misc';

/**
 * The card.
 *
 * One accessible name per card: the link wraps the headline, and the media is a second
 * link with `aria-hidden` art and `tabIndex={-1}` so a keyboard user reaches each story
 * once rather than twice (docs/09).
 */

export type CardSize = 'sm' | 'md' | 'lg' | 'hero';
export type CardLayout = 'vertical' | 'horizontal' | 'overlay';

export interface ArticleCardProps {
  article: ArticleSummary;
  size?: CardSize;
  layout?: CardLayout;
  showExcerpt?: boolean;
  showMeta?: boolean;
  showKicker?: boolean;
  /** Only the home/article LCP image. */
  priority?: boolean;
  headingLevel?: 'h2' | 'h3' | 'h4';
}

/**
 * The canonical URL of an article.
 *
 * Kal El permits a published article with no category, but this site has no route for
 * one: `/{slug}` is read by the catch-all as a desk. The repository already filters
 * those out of every listing, and this returns null so a caller that somehow holds one
 * renders plain text instead of a link that 404s.
 */
export function articleHref(article: Pick<ArticleSummary, 'slug' | 'category'>): string | null {
  return article.category ? `/${article.category.slug}/${article.slug}` : null;
}

export function ArticleCard({
  article,
  size = 'md',
  layout = 'vertical',
  showExcerpt = false,
  showMeta = true,
  showKicker = true,
  priority = false,
  headingLevel: Heading = 'h3',
}: ArticleCardProps) {
  const href = articleHref(article);
  const sizes = size === 'hero' ? SIZES.hero : layout === 'horizontal' ? SIZES.thumb : SIZES.card;
  const className = ['mn-card', `mn-card--${size}`, layout !== 'vertical' ? `mn-card--${layout}` : '']
    .filter(Boolean)
    .join(' ');

  const media =
    article.cover && href ? (
      <Link className="mn-card__media" href={href} tabIndex={-1} aria-hidden="true">
        <MnImage image={article.cover} alt="" sizes={sizes} priority={priority} />
        {article.template === 'video' ? (
          <span className="mn-playbadge">
            <span>
              <PlayIcon />
            </span>
          </span>
        ) : null}
        {layout === 'overlay' ? <span className="mn-card__scrim" /> : null}
      </Link>
    ) : null;

  const body = (
    <div className="mn-card__body">
      {showKicker && article.kicker ? <span className="mn-card__kicker">{article.kicker}</span> : null}
      <Heading className="mn-card__title">{href ? <Link href={href}>{article.title}</Link> : article.title}</Heading>
      {showExcerpt && article.excerpt ? <p className="mn-card__excerpt">{article.excerpt}</p> : null}
      {showMeta ? (
        <AuthorByline
          authors={article.authors}
          date={article.publishedAt ?? article.updatedAt}
          size={size === 'sm' ? 'sm' : 'md'}
        />
      ) : null}
    </div>
  );

  if (layout === 'overlay') {
    return (
      <article className={className}>
        {media}
        {body}
      </article>
    );
  }

  return (
    <article className={className}>
      {media}
      {body}
    </article>
  );
}
