import type { Metadata } from 'next';
import { AdSlot, AD_SLOTS, ArticleGrid, Breadcrumbs, Editorial, EmptyState, Pagination, SectionHeading } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, collectionNode, listingMetadata, absolute } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/** Review index. Separate from a desk because the schema type differs (docs/04). */
export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  return listingMetadata(seoContext(), {
    title: 'Reviews',
    description: 'Análises de produtos, box, edições de colecionador e hardware pela redação do Máquina Nerd.',
    path: '/reviews',
    page: Number(page ?? 1) || 1,
    pagination: 'query',
  });
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = Number(rawPage ?? 1) || 1;
  const ctx = seoContext();
  const result = await repo().listReviews(page);
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Reviews' }];

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [
          collectionNode(ctx, {
            name: 'Reviews',
            description: 'Análises de produtos e edições de colecionador.',
            url: absolute(ctx, '/reviews'),
            items: result.items,
          }),
          breadcrumbNode(ctx, crumbs),
        ])}
      />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Reviews</h1>
          <p className="mn-cathead__desc">
            Análises com nota, prós, contras e preço verificado. Quando um produto é cedido pelo fabricante, isso vem
            declarado acima do título.
          </p>
        </header>

        <div className="mn-section">
          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhuma análise publicada ainda"
              description="As análises da redação aparecem aqui assim que forem publicadas."
              action={{ label: 'Ver a home', href: '/' }}
            />
          ) : (
            <>
              <SectionHeading label="Todas as análises" />
              <ArticleGrid articles={result.items} columns={3} showExcerpt />
              <Pagination
                page={page}
                totalPages={result.totalPages}
                hasNext={result.hasNext}
                hrefFor={(n) => (n === 1 ? '/reviews' : `/reviews?page=${n}`)}
              />
            </>
          )}
        </div>

        <div className="mn-section--tight">
          <AdSlot
            id="ad-reviews-leaderboard"
            {...AD_SLOTS.leaderboard}
            targeting={{ brand: 'mn', template: 'reviews' }}
          />
        </div>
      </Editorial>
    </>
  );
}
