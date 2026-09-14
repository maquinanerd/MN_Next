import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { RESERVED_SEGMENTS, articlePath, safeSlugParam } from '@mn/content';
import { JsonLd, articleMetadata, articleNode, breadcrumbNode, buildGraph, reviewNode } from '@mn/seo';

import { ArticleView } from '../../../components/ArticleView';
import { materiaView, repo } from '../../../lib/content';
import { previewAllows } from '../../../lib/preview';
import { safeInternalPath } from '../../../lib/redirects';
import { seoContext } from '../../../lib/seo-context';

/**
 * Article at `/{editoria}/{slug}` — the standard and overlay compositions. Offer pages
 * live at `/ofertas/{slug}` and are redirected there.
 *
 * ISR at 300 s with a per-article tag: publication revalidates the tag immediately, the
 * window is the backstop if a webhook is lost. Draft mode bypasses both.
 */
export const revalidate = 300;
export const dynamicParams = true;

type Params = { categoria: string; slug: string };

/**
 * Prerenders the most recent articles; older ones render on first request. Bounded so a
 * deploy is not proportional to a ten-year archive, and a CMS outage during the build
 * yields an empty list rather than a failed build.
 */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const recent = await repo().listRecentNews(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 500);
    return recent
      .filter((a) => a.layout !== 'offer' && a.category !== null)
      .map((a) => ({ categoria: a.category?.slug ?? '', slug: a.slug }))
      .filter((p) => p.categoria !== '');
  } catch {
    return [];
  }
}

/**
 * Loads the article — in preview only when the signed grant names this exact slug.
 * `draftMode()` alone is a global switch and would turn one token into a key to every
 * unpublished slug a visitor can guess.
 */
async function load(params: Params) {
  const categoria = safeSlugParam(params.categoria);
  const slug = safeSlugParam(params.slug);
  if (!categoria || !slug || RESERVED_SEGMENTS.has(categoria)) return { article: null, preview: false, requested: '' };
  const preview = await previewAllows(slug);
  const article = await repo().getArticleBySlug(slug, preview ? { preview: true } : undefined);
  return { article, preview, requested: `/${categoria}/${slug}` };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const loaded = await load(await params).catch(() => ({ article: null, preview: false }));
  if (!loaded.article) return { title: 'Matéria não encontrada', robots: { index: false, follow: false } };
  const meta = articleMetadata(seoContext(), loaded.article);
  // A preview is never indexable, whatever the article's own SEO says.
  return loaded.preview ? { ...meta, robots: { index: false, follow: false, nocache: true } } : meta;
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { article, preview, requested } = await load(await params);
  if (!article) notFound();
  const canonical = articlePath(article);
  if (!canonical) notFound();

  // One address per article. An offer lives under /ofertas; an article asked for under
  // another editoria — a WordPress post filed in several categories, a desk renamed after
  // the link was shared — goes to its own with a 308, instead of a 404 or a duplicate.
  if (!preview && canonical !== requested) {
    const target = safeInternalPath(canonical);
    if (!target) notFound();
    permanentRedirect(target);
  }

  const view = await materiaView(article);
  if (!view) notFound();

  const ctx = seoContext();
  const crumbs = [
    { label: 'Home', href: '/' },
    ...(article.category ? [{ label: article.category.name, href: `/${article.category.slug}` }] : []),
    { label: article.title },
  ];

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [articleNode(ctx, article), reviewNode(ctx, article), breadcrumbNode(ctx, crumbs)])}
      />
      <ArticleView view={view} preview={preview} />
    </>
  );
}
