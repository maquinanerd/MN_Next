import Link from 'next/link';
import type { ArticleSummary } from '@mn/content';

import { ArticleCard, articleHref, type CardSize } from './ArticleCard';

export interface ArticleGridProps {
  articles: ArticleSummary[];
  columns?: 2 | 3 | 4;
  size?: CardSize;
  showExcerpt?: boolean;
  showMeta?: boolean;
  headingLevel?: 'h2' | 'h3' | 'h4';
}

export function ArticleGrid({
  articles,
  columns = 3,
  size = 'md',
  showExcerpt = false,
  showMeta = true,
  headingLevel = 'h3',
}: ArticleGridProps) {
  return (
    <div className={`mn-grid mn-grid--${columns}`}>
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          size={size}
          showExcerpt={showExcerpt}
          showMeta={showMeta}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}

/**
 * Numbered "most read" rail. The rank is decorative; the link carries the name.
 *
 * The title belongs *inside* the panel, as a header bar with its own rule — the design
 * draws one bordered box, and a heading floating above it is a different component.
 */
export function MostRead({
  items,
  numbered = true,
  title,
}: {
  items: ArticleSummary[];
  numbered?: boolean;
  title?: string;
}) {
  return (
    <div className="mn-mostread">
      {title ? <p className="mn-mostread__head">{title}</p> : null}
      {items.map((article, index) => (
        <div className="mn-mostread__item" key={article.id}>
          {numbered ? (
            <span className="mn-mostread__rank" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
          ) : null}
          <h3 className="mn-mostread__title">
            {articleHref(article) ? <Link href={articleHref(article) as string}>{article.title}</Link> : article.title}
          </h3>
        </div>
      ))}
    </div>
  );
}
