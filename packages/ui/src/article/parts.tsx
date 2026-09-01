import Link from 'next/link';
import type { ArticleSummary, Author, LiveEntry, Tag } from '@mn/content';

import { ArticleCard } from '../cards/ArticleCard';
import { SectionHeading } from '../primitives/misc';

export function TagList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mn-taglist">
      <span className="mn-taglist__label">Tags</span>
      {tags.map((tag) => (
        <Link className="mn-tag" key={tag.id} href={`/tag/${tag.slug}`}>
          {tag.name}
        </Link>
      ))}
    </div>
  );
}

export function AuthorBox({ author }: { author: Author }) {
  return (
    <aside className="mn-authorbox">
      <span className="mn-authorbox__avatar" style={{ background: author.avatarColor }} aria-hidden="true">
        {author.initials}
      </span>
      <div>
        <p className="mn-authorbox__name">
          <Link href={`/autor/${author.slug}`}>{author.name}</Link>
        </p>
        {author.bio ? <p className="mn-authorbox__bio">{author.bio}</p> : null}
      </div>
    </aside>
  );
}

export function RelatedArticles({ articles, title = 'Leia também' }: { articles: ArticleSummary[]; title?: string }) {
  if (articles.length === 0) return null;
  return (
    <section className="mn-section--tight" aria-label={title}>
      <SectionHeading label={title} as="h2" />
      <div className="mn-grid mn-grid--3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} size="sm" showMeta={false} headingLevel="h3" />
        ))}
      </div>
    </section>
  );
}

/**
 * Update timeline for the `urgent` template.
 *
 * Entries are ordered newest first, and the most recent one is marked - both visually
 * and in text, so the state is not carried by the dot colour alone.
 */
export function UpdateTimeline({ entries }: { entries: LiveEntry[] }) {
  return (
    <ol className="mn-timeline" style={{ listStyle: 'none', margin: 0, padding: 0, paddingLeft: 24 }}>
      {entries.map((entry, index) => (
        <li
          className={index === 0 ? 'mn-timeline__item mn-timeline__item--latest' : 'mn-timeline__item'}
          key={entry.id}
        >
          <p className="mn-timeline__time">
            <time dateTime={entry.time}>
              {new Intl.DateTimeFormat('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
                timeZone: 'America/Sao_Paulo',
              }).format(new Date(entry.time))}
            </time>
            {index === 0 ? <span> · atualização mais recente</span> : null}
          </p>
          {entry.title ? <p className="mn-timeline__title">{entry.title}</p> : null}
          <p className="mn-timeline__text">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}
