import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import {
  AdSlot,
  AD_SLOTS,
  ArticleCard,
  ArticleGrid,
  Breadcrumbs,
  Editorial,
  MnImage,
  SIZES,
  SectionHeading,
} from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, collectionNode, listingMetadata, absolute } from '@mn/seo';

import { repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/** Franchise hub at `/especiais/{franquia}`. */
export const revalidate = 300;

type Params = { franquia: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { franquia } = await params;
  const slug = safeSlugParam(franquia);
  if (!slug) return { title: 'Especial não encontrado', robots: { index: false } };
  const special = await repo()
    .getSpecial([slug])
    .catch(() => null);
  if (!special) return { title: 'Especial não encontrado', robots: { index: false } };
  return listingMetadata(seoContext(), {
    title: `${special.franchise.name} — especial`,
    description: special.franchise.description,
    path: `/especiais/${slug}`,
    image: special.franchise.cover,
  });
}

export default async function FranchiseHubPage({ params }: { params: Promise<Params> }) {
  const { franquia } = await params;
  const slug = safeSlugParam(franquia);
  if (!slug) notFound();
  const special = await repo().getSpecial([slug]);
  if (!special) notFound();

  const ctx = seoContext();
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Especiais', href: '/especiais' },
    { label: special.franchise.name },
  ];
  const url = absolute(ctx, `/especiais/${slug}`);

  const graph = buildGraph(ctx, [
    collectionNode(ctx, {
      name: special.franchise.name,
      description: special.franchise.description,
      url,
      items: special.articles,
    }),
    breadcrumbNode(ctx, crumbs),
  ]);

  const [lead, ...rest] = special.articles;

  return (
    <>
      <JsonLd graph={graph} />

      <Editorial>
        <Breadcrumbs items={crumbs} />

        <header className="mn-hub__cover">
          {special.franchise.cover ? (
            <MnImage image={special.franchise.cover} alt="" sizes={SIZES.full} priority />
          ) : null}
          <span className="mn-hub__scrim" aria-hidden="true" />
          <div className="mn-hub__body">
            <p className="mn-longform__kickers">
              <span>Especial</span>
            </p>
            <h1 className="mn-hub__title">{special.franchise.name}</h1>
            <p className="mn-hub__desc">{special.franchise.description}</p>
          </div>
        </header>

        {special.dossiers.length > 0 ? (
          <section className="mn-section" aria-label="Dossiês">
            <SectionHeading label="Dossiês" />
            <div className="mn-grid mn-grid--3">
              {special.dossiers.map((dossier) => (
                <Link className="mn-card" key={dossier.id} href={`/especiais/${slug}/${dossier.slug}`}>
                  <span className="mn-card__kicker">{dossier.kicker}</span>
                  <span className="mn-card__title">{dossier.title}</span>
                  <span className="mn-card__excerpt">{dossier.chapters.length} capítulos</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {special.franchise.timeline && special.franchise.timeline.length > 0 ? (
          <section className="mn-section" aria-label="Linha do tempo">
            <SectionHeading label="Ordem de exibição" />
            <ol className="mn-timeline-list">
              {special.franchise.timeline.map((entry) => (
                <li key={entry.label}>
                  <p className="mn-timeline__time">{entry.label}</p>
                  <p className="mn-timeline__text">{entry.text}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="mn-section" aria-label="Últimas do universo">
          <SectionHeading label="Últimas do universo" />
          {lead ? <ArticleCard article={lead} size="lg" showExcerpt headingLevel="h3" /> : null}
          <div style={{ marginTop: 32 }}>
            <ArticleGrid articles={rest} columns={3} />
          </div>
        </section>

        <div className="mn-section--tight">
          <AdSlot
            id="ad-hub-leaderboard"
            {...AD_SLOTS.leaderboard}
            targeting={{ brand: 'mn', template: 'especiais', categoria: slug }}
          />
        </div>
      </Editorial>
    </>
  );
}
