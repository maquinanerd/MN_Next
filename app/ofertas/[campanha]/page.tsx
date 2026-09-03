import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { Fragment } from 'react';
import { ArticleBody, Breadcrumbs, Editorial, MnImage, OfferTicker, SIZES, SponsoredLabel } from '@mn/ui';
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
  /*
   * The "Ofertas" badge is a commercial claim, not a decoration.
   *
   * This route serves any article reachable by slug, and the badge was rendered for all
   * of them — putting an advertising mark on editorial copy that carries none. Labelling
   * editorial content as paid is the same failure as leaving paid content unlabelled,
   * only in the other direction. The band itself is just a hero treatment and stays.
   */
  const isCampaign = article.commercial?.kind === 'campaign';

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      {/*
       * The campaign band, full width and outside the editorial column.
       *
       * The route used to render a black bar with the headline in it — the same page as
       * any article with a dark title. The design opens a seasonal landing as a campaign:
       * the mark, the badge, the name at poster scale, and the terms running underneath.
       */}
      <section className="mn-campaign" aria-label={article.title}>
        <div className="mn-campaign__inner">
          <div className="mn-campaign__lede">
            <span className="mn-campaign__stamp">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mn-logo-on-dark.png" alt="" width={78} height={15} className="mn-campaign__logo" />
              {isCampaign ? <span className="mn-campaign__badge">Ofertas</span> : null}
            </span>
            <h1 className="mn-campaign__title">{article.title}</h1>
            {article.subtitle ? <p className="mn-campaign__dek">{article.subtitle}</p> : null}
          </div>
          {article.cover ? (
            <div className="mn-campaign__media">
              <MnImage image={article.cover} alt="" sizes={SIZES.card} priority />
            </div>
          ) : null}
        </div>

        {article.commercial?.campaignTerms && article.commercial.campaignTerms.length > 0 ? (
          <div className="mn-campaign__terms">
            <p className="mn-campaign__termsinner">
              {article.commercial.campaignTerms.map((term, index) => (
                <Fragment key={term}>
                  {index > 0 ? (
                    <span className="mn-campaign__sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <span className="mn-campaign__term">{term}</span>
                </Fragment>
              ))}
            </p>
          </div>
        ) : null}
      </section>

      <Editorial>
        <Breadcrumbs items={crumbs} />

        {article.commercial ? (
          <SponsoredLabel
            kind={article.commercial.kind}
            brand={article.commercial.brandName}
            {...(article.commercial.brandLogo ? { brandLogo: article.commercial.brandLogo } : {})}
          />
        ) : null}

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
