import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSlot, AD_SLOTS, ArticleGrid, Editorial, EmptyState, MnImage, SIZES, SectionHeading } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/** Index of franchise hubs. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Especiais',
    description: 'Dossiês, coberturas e mergulhos de franquia do Máquina Nerd.',
    path: '/especiais',
  });
}

export default async function SpecialsIndexPage() {
  const ctx = seoContext();
  const specials = await repo().listSpecials();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Especiais' }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Especiais</h1>
          <p className="mn-cathead__desc">
            Coberturas longas, dossiês de franquia e tudo o que precisa de mais de uma matéria para caber.
          </p>
        </header>

        {specials.length === 0 ? (
          <div style={{ paddingBlock: 48 }}>
            <EmptyState
              title="Nenhum especial publicado ainda"
              description="Os dossiês aparecem aqui assim que a redação publicar o primeiro capítulo."
              action={{ label: 'Ver a home', href: '/' }}
            />
          </div>
        ) : (
          <div className="mn-section">
            {specials.map((special) => (
              <section key={special.franchise.id} className="mn-section--tight" aria-label={special.franchise.name}>
                <SectionHeading label={special.franchise.name} href={`/especiais/${special.franchise.slug}`} />
                {special.franchise.cover ? (
                  <Link className="mn-hub__cover" href={`/especiais/${special.franchise.slug}`}>
                    <MnImage image={special.franchise.cover} alt="" sizes={SIZES.hero} />
                    <span className="mn-hub__scrim" aria-hidden="true" />
                    <span className="mn-hub__body">
                      <span className="mn-hub__title">{special.franchise.name}</span>
                      <span className="mn-hub__desc">{special.franchise.description}</span>
                    </span>
                  </Link>
                ) : null}
                <div style={{ marginTop: 24 }}>
                  <ArticleGrid articles={special.articles.slice(0, 3)} columns={3} showMeta={false} />
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mn-section--tight">
          <AdSlot
            id="ad-specials-leaderboard"
            {...AD_SLOTS.leaderboard}
            targeting={{ brand: 'mn', template: 'especiais' }}
          />
        </div>
      </Editorial>
    </>
  );
}
