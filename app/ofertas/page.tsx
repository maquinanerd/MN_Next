import type { Metadata } from 'next';
import { AdSlot, AD_SLOTS, ArticleGrid, Breadcrumbs, Editorial, EmptyState, Pagination, SectionHeading } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, collectionNode, listingMetadata, absolute } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/** Offers index. Every item here is commercial and says so. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Ofertas',
    description: 'Ofertas de quadrinhos, colecionáveis e hardware filtradas pela redação, com preço verificado.',
    path: '/ofertas',
  });
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = Number(rawPage ?? 1) || 1;
  const ctx = seoContext();
  const result = await repo().listOffers(page);
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Ofertas' }];

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [
          collectionNode(ctx, {
            name: 'Ofertas',
            description: 'Ofertas com preço verificado.',
            url: absolute(ctx, '/ofertas'),
            items: result.items,
          }),
          breadcrumbNode(ctx, crumbs),
        ])}
      />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Ofertas</h1>
          <p className="mn-cathead__desc">
            Seleção da redação, com preço e data de verificação visíveis. Os links de compra são de afiliados e podem
            gerar comissão, sem alterar o valor final para você.
          </p>
        </header>

        <div className="mn-section">
          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhuma oferta ativa no momento"
              description="Quando a redação encontrar um preço que vale a pena, ele aparece aqui."
              action={{ label: 'Ver reviews', href: '/reviews' }}
            />
          ) : (
            <>
              <SectionHeading label="Ofertas ativas" />
              <ArticleGrid articles={result.items} columns={3} showExcerpt />
              <Pagination
                page={page}
                totalPages={result.totalPages}
                hasNext={result.hasNext}
                hrefFor={(n) => (n === 1 ? '/ofertas' : `/ofertas?page=${n}`)}
              />
            </>
          )}
        </div>

        <div className="mn-section--tight">
          <AdSlot
            id="ad-offers-leaderboard"
            {...AD_SLOTS.leaderboard}
            targeting={{ brand: 'mn', template: 'ofertas' }}
          />
        </div>
      </Editorial>
    </>
  );
}
