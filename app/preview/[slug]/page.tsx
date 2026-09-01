import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { ArticleBody, ArticleHeader, Editorial } from '@mn/ui';

import { repo } from '../../../lib/content';
import { previewAllows } from '../../../lib/preview';
import { seoContext } from '../../../lib/seo-context';

/**
 * Category-less preview surface.
 *
 * Reached when a Kal El preview token opens an article that has no desk yet, so
 * `/{categoria}/{slug}` does not exist. Once the article has a category, the reader is
 * sent to the canonical path so the preview shows the real template in its real shell.
 *
 * Always dynamic and never indexable. Outside draft mode it is a 404, so the URL is not
 * a public back door into unpublished copy.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pré-visualização',
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = safeSlugParam(raw);
  if (!slug) notFound();

  // The grant must name this exact slug: a preview session is not a master key.
  if (!(await previewAllows(slug))) notFound();

  const article = await repo().getArticleBySlug(slug, { preview: true });
  if (!article) notFound();
  if (article.category) redirect(`/${article.category.slug}/${article.slug}`);

  const canonical = `${seoContext().siteUrl}/preview/${article.slug}`;

  return (
    <>
      <div className="mn-breaking">
        <Editorial>
          <span className="mn-breaking__badge">Pré-visualização</span>{' '}
          <span className="mn-breaking__text">
            Versão não publicada, sem editoria definida.{' '}
            <Link href="/api/preview/disable">Sair da pré-visualização</Link>
          </span>
        </Editorial>
      </div>

      <Editorial>
        <article className="mn-article">
          <div>
            <ArticleHeader article={article} shareUrl={canonical} priorityImage={false} />
            <ArticleBody blocks={article.body} showAds={false} />
          </div>
        </article>
      </Editorial>
    </>
  );
}
