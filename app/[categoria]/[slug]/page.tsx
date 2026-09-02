import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';
import { isBrandUnsafe } from '@mn/content/kalel/mapper';
import {
  AdSlot,
  AD_SLOTS,
  ArticleBody,
  ArticleHeader,
  AuthorBox,
  Breadcrumbs,
  Editorial,
  MostRead,
  GridSkeleton,
  RelatedArticles,
  ReviewVerdict,
  TagList,
  UpdateTimeline,
} from '@mn/ui';
import { JsonLd, articleMetadata, articleNode, breadcrumbNode, buildGraph, reviewNode } from '@mn/seo';

import { optional, repo } from '../../../lib/content';
import { previewAllows } from '../../../lib/preview';
import { seoContext } from '../../../lib/seo-context';

/**
 * Article at `/{categoria}/{slug}` - the URL shape the WordPress archive already uses,
 * preserved exactly (docs/04).
 *
 * ISR at 300 s with a per-article tag: publication revalidates the tag immediately, and
 * the window is the backstop if a webhook is ever lost. Draft mode bypasses both.
 */
export const revalidate = 300;
export const dynamicParams = true;

type Params = { categoria: string; slug: string };

/**
 * Prerenders the most recent articles; everything older is ISR on demand (docs/04).
 *
 * Bounded at 500 because a full-archive prerender would make every deploy proportional
 * to the size of a ten-year corpus. A CMS outage during a build returns an empty list
 * rather than failing the build - the charter forbids letting a missing dependency block
 * it, and those routes simply render on first request instead.
 */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const recent = await repo().listRecentNews(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 500);
    return recent
      .filter((a) => a.category !== null)
      .map((a) => ({ categoria: a.category?.slug ?? '', slug: a.slug }))
      .filter((p) => p.categoria !== '');
  } catch {
    return [];
  }
}

/**
 * Loads the article, in preview only when the session's signed grant names this exact
 * slug. `draftMode()` alone is a global flag and would otherwise turn one legitimately
 * issued token into a key to every unpublished slug a visitor can guess.
 */
async function load(params: Params) {
  const categoria = safeSlugParam(params.categoria);
  const slug = safeSlugParam(params.slug);
  if (!categoria || !slug || RESERVED_SEGMENTS.has(categoria)) return { article: null, preview: false };
  const preview = await previewAllows(slug);
  const article = await repo().getArticle(categoria, slug, preview ? { preview: true } : undefined);
  return { article, preview };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await params;
  const loaded = await load(resolved).catch(() => ({ article: null, preview: false }));
  if (!loaded.article) return { title: 'Matéria não encontrada', robots: { index: false, follow: false } };
  const meta = articleMetadata(seoContext(), loaded.article);
  // A preview must never be indexable, whatever the article's own SEO says.
  return loaded.preview ? { ...meta, robots: { index: false, follow: false, nocache: true } } : meta;
}

/**
 * The related rail and the most-read list are secondary reads. They stream inside the
 * article rather than blocking it, and a failure in either degrades to nothing.
 */
async function Related({ articleId, categorySlug }: { articleId: string; categorySlug: string | null }) {
  if (!categorySlug) return null;
  const related = await optional(
    repo()
      .listCategory(categorySlug, 1)
      .then((page) => page.items.filter((a) => a.id !== articleId).slice(0, 3)),
    'related',
  );
  return <RelatedArticles articles={related ?? []} />;
}

async function MostReadRail({ excludeId }: { excludeId: string }) {
  const mostRead = await optional(
    repo()
      .getHome()
      .then((home) => home.mostRead.filter((a) => a.id !== excludeId).slice(0, 4)),
    'most-read',
  );
  if (!mostRead || mostRead.length === 0) return null;
  return <MostRead items={mostRead} title="Mais lidas" />;
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const ctx = seoContext();

  const { article, preview } = await load(resolved);
  if (!article) notFound();

  const crumbs = [
    { label: 'Home', href: '/' },
    ...(article.category ? [{ label: article.category.name, href: `/${article.category.slug}` }] : []),
    { label: article.title },
  ];

  const canonical = article.seo.canonical ?? `${ctx.siteUrl}/${article.category?.slug ?? ''}/${article.slug}`;
  const sponsored = article.commercial?.kind === 'affiliate' || article.commercial?.kind === 'campaign';
  // Brand safety is decided on the server: an article tagged for a tragedy or a lawsuit
  // gets no in-article or sidebar inventory at all (docs/07).
  const adsAllowed = !isBrandUnsafe(article.tags);

  const graph = buildGraph(ctx, [articleNode(ctx, article), reviewNode(ctx, article), breadcrumbNode(ctx, crumbs)]);

  const isLongform = article.template === 'longform';

  return (
    <>
      <JsonLd graph={graph} />

      {preview ? (
        <div className="mn-breaking">
          <Editorial>
            <span className="mn-breaking__badge">Pré-visualização</span>{' '}
            <span className="mn-breaking__text">
              Você está vendo uma versão não publicada. Esta página não é indexada.{' '}
              <Link href="/api/preview/disable">Sair da pré-visualização</Link>
            </span>
          </Editorial>
        </div>
      ) : null}

      {isLongform ? <ArticleHeader article={article} shareUrl={canonical} /> : null}

      <Editorial>
        {isLongform ? null : <Breadcrumbs items={crumbs} />}

        <article className={isLongform ? '' : 'mn-article'}>
          <div>
            {isLongform ? null : <ArticleHeader article={article} shareUrl={canonical} />}

            {article.template === 'urgent' ? (
              <section aria-label="Linha do tempo das atualizações" style={{ marginBottom: 32 }}>
                <UpdateTimeline
                  entries={article.body
                    .filter((b): b is Extract<typeof b, { type: 'heading' }> => b.type === 'heading')
                    .map((h) => ({ id: h.id, time: article.updatedAt, title: h.text, text: h.text }))}
                />
              </section>
            ) : null}

            {article.commercial && !isLongform ? (
              <p className="mn-disclosure" style={{ padding: 0, marginBottom: 24 }}>
                {article.commercial.disclosure}
              </p>
            ) : null}

            <ArticleBody
              blocks={article.body}
              sponsored={sponsored}
              showAds={adsAllowed}
              dropcapFirstParagraph={isLongform}
              adTargeting={{
                brand: 'mn',
                categoria: article.category?.slug ?? 'geral',
                template: article.template,
                comercial: article.commercial ? 'sim' : 'nao',
                tags: article.tags.slice(0, 10).map((t) => t.slug),
              }}
            />

            {article.review ? (
              <section className="mn-section--tight" aria-label="Veredito">
                <ReviewVerdict review={article.review} />
              </section>
            ) : null}

            <TagList tags={article.tags} />

            {article.authors[0] ? <AuthorBox author={article.authors[0]} /> : null}

            {adsAllowed ? (
              <div className="mn-section--tight">
                <AdSlot id="ad-article-end" {...AD_SLOTS.inArticle} />
              </div>
            ) : null}

            <Suspense fallback={<GridSkeleton count={3} />}>
              <Related articleId={article.id} categorySlug={article.category?.slug ?? null} />
            </Suspense>
          </div>

          {isLongform ? null : (
            <aside className="mn-article__aside" aria-label="Complementos">
              <Suspense fallback={null}>
                <MostReadRail excludeId={article.id} />
              </Suspense>
              {adsAllowed ? <AdSlot id="ad-article-sidebar" {...AD_SLOTS.sidebar} sticky /> : null}
            </aside>
          )}
        </article>
      </Editorial>
    </>
  );
}
