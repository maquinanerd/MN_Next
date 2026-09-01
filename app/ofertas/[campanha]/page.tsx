import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { ArticleBody, Breadcrumbs, Editorial, OfferTicker, SponsoredLabel } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, noindexMetadata, listingMetadata } from '@mn/seo';

import { repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Seasonal campaign landing at `/ofertas/{campanha}`.
 *
 * A third-party paid landing is `noindex` (docs/07): it is advertising, and indexing it
 * competes with the editorial archive for the same queries. Editorial round-ups under
 * this route stay indexable.
 */
export const revalidate = 300;

type Params = { campanha: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { campanha } = await params;
  const slug = safeSlugParam(campanha);
  const ctx = seoContext();
  if (!slug) return { title: 'Campanha não encontrada', robots: { index: false } };
  const article = await repo()
    .getArticleBySlug(slug)
    .catch(() => null);
  if (!article) return { title: 'Campanha não encontrada', robots: { index: false } };

  const paid = article.commercial?.kind === 'campaign';
  return paid
    ? noindexMetadata(ctx, article.title, article.excerpt, `/ofertas/${slug}`)
    : listingMetadata(ctx, {
        title: article.title,
        description: article.excerpt,
        path: `/ofertas/${slug}`,
        image: article.cover,
      });
}

export default async function CampaignPage({ params }: { params: Promise<Params> }) {
  const { campanha } = await params;
  const slug = safeSlugParam(campanha);
  if (!slug) notFound();
  const article = await repo().getArticleBySlug(slug);
  if (!article) notFound();

  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Ofertas', href: '/ofertas' }, { label: article.title }];

  const offers = article.commercial?.offers ?? [];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />

        {article.commercial ? (
          <SponsoredLabel kind={article.commercial.kind} brand={article.commercial.brandName} />
        ) : null}

        <header className="mn-landing__hero">
          <h1 className="mn-landing__title">{article.title}</h1>
          {article.subtitle ? <p className="mn-longform__dek">{article.subtitle}</p> : null}
        </header>

        {offers.length > 0 ? (
          <div className="mn-section--tight">
            <OfferTicker items={offers.map((o) => ({ label: o.retailer, price: o.price }))} />
          </div>
        ) : null}

        <div className="mn-section">
          <ArticleBody blocks={article.body} sponsored showAds={false} />
        </div>

        {article.commercial ? <p className="mn-disclosure">{article.commercial.disclosure}</p> : null}
      </Editorial>
    </>
  );
}
