import Link from 'next/link';
import type { Article } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { AuthorByline } from '../cards/AuthorByline';
import { ShareBar } from './ShareBar';
import { SponsoredLabel } from '../commercial/SponsoredLabel';
import { Editorial, Shell } from '../primitives/misc';

/**
 * Article header, one composition per approved template.
 *
 * `longform` is a full-bleed cover with the title over the image; `urgent` opens with the
 * live strip and an update stamp; the rest are the column + sidebar layout. A commercial
 * article always renders `<SponsoredLabel />` above the headline - never below, never
 * collapsible (docs/07).
 */

export interface ArticleHeaderProps {
  article: Article;
  shareUrl: string;
  priorityImage?: boolean;
}

function readingLabel(minutes: number): string {
  return `${minutes} min de leitura`;
}

export function ArticleHeader({ article, shareUrl, priorityImage = true }: ArticleHeaderProps) {
  const byline = (
    <AuthorByline
      authors={article.authors}
      date={article.publishedAt ?? article.updatedAt}
      suffix={readingLabel(article.readingMinutes)}
    />
  );

  if (article.template === 'longform') {
    return (
      <header className="mn-longform__cover">
        {article.cover ? <MnImage image={article.cover} alt="" sizes={SIZES.full} priority={priorityImage} /> : null}
        <span className="mn-longform__scrim" aria-hidden="true" />
        <Editorial>
          <div className="mn-longform__inner">
            <div className="mn-longform__kickers">
              <span>Grande reportagem</span>
              {article.category ? <span>{article.category.name}</span> : null}
            </div>
            <h1 className="mn-longform__title">{article.title}</h1>
            {article.subtitle ? <p className="mn-longform__dek">{article.subtitle}</p> : null}
            <div style={{ marginTop: 20 }}>{byline}</div>
          </div>
        </Editorial>
      </header>
    );
  }

  return (
    <header>
      {article.template === 'urgent' ? (
        <div className="mn-urgent__strip">
          <Shell>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mn-live-badge">
                <span className="mn-live-badge__pulse" aria-hidden="true" />
                Ao vivo
              </span>
              <span>
                Cobertura em tempo real · atualizado às{' '}
                <time dateTime={article.updatedAt}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(article.updatedAt))}
                </time>
              </span>
            </div>
          </Shell>
        </div>
      ) : null}

      {article.commercial ? (
        <SponsoredLabel kind={article.commercial.kind} brand={article.commercial.brandName} />
      ) : null}

      {article.category ? (
        <Link className="mn-article__kicker" href={`/${article.category.slug}`}>
          {article.category.name}
        </Link>
      ) : null}

      <h1 className="mn-article__title">{article.title}</h1>
      {article.subtitle ? <p className="mn-article__dek">{article.subtitle}</p> : null}

      <div className="mn-article__meta">
        {byline}
        <ShareBar url={shareUrl} title={article.title} />
      </div>

      {article.cover && article.template !== 'video' ? (
        <figure className="mn-article__figure">
          <div className="mn-figure__frame" style={{ position: 'relative' }}>
            <MnImage image={article.cover} sizes={SIZES.hero} priority={priorityImage} />
          </div>
          {article.cover.caption || article.cover.credit ? (
            <figcaption className="mn-figure__caption">
              {article.cover.caption}{' '}
              {article.cover.credit ? <span className="mn-figure__credit">{article.cover.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </header>
  );
}
