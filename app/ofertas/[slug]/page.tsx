import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articlePath, safeSlugParam } from '@mn/content';
import { JsonLd, articleMetadata, articleNode, breadcrumbNode, buildGraph } from '@mn/seo';

import { ArticleView } from '../../../components/ArticleView';
import { Moved } from '../../../components/Moved';
import { materiaView, repo } from '../../../lib/content';
import { previewAllows } from '../../../lib/preview';
import { safeInternalPath } from '../../../lib/redirects';
import { seoContext } from '../../../lib/seo-context';

/**
 * Offer page at `/ofertas/{slug}` (Máquina Nerd Notícias Publi.dc.html). An article that
 * is not an offer is sent to its own address; an unknown slug is a 404.
 */
export const revalidate = 300;
export const dynamicParams = true;

type Params = { slug: string };

async function load(params: Params) {
  const slug = safeSlugParam(params.slug);
  if (!slug) return { article: null, preview: false };
  const preview = await previewAllows(slug);
  const article = await repo().getArticleBySlug(slug, preview ? { preview: true } : undefined);
  return { article, preview };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const loaded = await load(await params).catch(() => ({ article: null, preview: false }));
  if (!loaded.article || loaded.article.layout !== 'offer') {
    return { title: 'Oferta não encontrada', robots: { index: false, follow: false } };
  }
  const meta = articleMetadata(seoContext(), loaded.article);
  return loaded.preview ? { ...meta, robots: { index: false, follow: false, nocache: true } } : meta;
}

export default async function OfferPage({ params }: { params: Promise<Params> }) {
  const { article, preview } = await load(await params);
  if (!article) notFound();
  if (article.layout !== 'offer') {
    // Sent on with `Moved`: a redirect thrown from this cached page comes back from the
    // cache with no `Location`.
    const path = safeInternalPath(articlePath(article) ?? '');
    if (path) return <Moved to={path} />;
    notFound();
  }

  const view = await materiaView(article);
  if (!view) notFound();

  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Ofertas', href: '/ofertas' }, { label: article.title }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [articleNode(ctx, article), breadcrumbNode(ctx, crumbs)])} />
      <ArticleView view={view} preview={preview} />
    </>
  );
}
