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
  SectionHeading,
  FranchiseHero,
  DateTime,
  type FranchiseStat,
} from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, collectionNode, listingMetadata, absolute } from '@mn/seo';

import { optional, repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/** Franchise hub at `/especiais/{franquia}`. */
export const revalidate = 300;

/**
 * The figures beside the franchise title.
 *
 * Every one is counted from content that exists. The design's cells are audience and
 * production numbers this platform does not hold; these answer the same question — how
 * big is this thing, and is it alive — with what it does hold.
 */
function hubStats(
  special: NonNullable<Awaited<ReturnType<ReturnType<typeof repo>['getSpecial']>>>,
  total: number | null,
): FranchiseStat[] {
  const chapters = special.dossiers.reduce((n, d) => n + d.chapters.length, 0);
  // Only `publishedAt`: an edit is not a publication, and this cell says when the
  // franchise last had something new.
  const latest = special.articles.find((a) => a.publishedAt !== null)?.publishedAt ?? null;
  return [
    // `special.articles` is a *window* — the CMS returns a page, not the archive — so
    // counting it states a number that is simply wrong on any franchise with more
    // articles than fit. The desk listing knows the real total; when it cannot say, the
    // cell is omitted rather than filled with the window's length.
    ...(total !== null ? [{ label: 'Matérias', value: total.toLocaleString('pt-BR') }] : []),
    { label: 'Dossiês', value: String(special.dossiers.length) },
    ...(chapters > 0 ? [{ label: 'Capítulos', value: String(chapters) }] : []),
    ...(latest
      ? [
          {
            label: 'Última',
            value: new Intl.DateTimeFormat('pt-BR', {
              month: 'short',
              year: 'numeric',
              timeZone: 'America/Sao_Paulo',
            })
              .format(new Date(latest))
              .replace('.', ''),
          },
        ]
      : []),
  ].slice(0, 4);
}

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
  // The sibling franchises become the tab row. A failure here costs the tabs, not the
  // page: the hub is about this franchise, and the others are navigation.
  const siblings = (await optional(repo().listSpecials(), 'hub-siblings')) ?? [];
  // The real archive size for this franchise, which `getSpecial` cannot report.
  const listing = await optional(repo().listCategory(slug, 1), 'hub-total');

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

      {/*
       * Full-bleed, so outside `Editorial`. The figures beside the title are counted
       * from what the platform actually holds — the prototype's "9,3 mi na estreia" and
       * "612 matérias" are numbers this site does not record, and inventing them would
       * put fiction on a page that otherwise reports.
       */}
      <FranchiseHero
        franchise={special.franchise}
        siblings={siblings.map((s) => ({ slug: s.franchise.slug, name: s.franchise.name }))}
        stats={hubStats(special, listing?.total ?? null)}
      />

      <Editorial>
        <Breadcrumbs items={crumbs} />

        {special.franchise.timeline && special.franchise.timeline.length > 0 ? (
          <section className="mn-section" aria-label="O que vem por aí">
            <SectionHeading label="O que vem por aí" />
            <div className="mn-upcoming">
              {special.franchise.timeline.map((entry) => (
                <article className="mn-upcoming__item" key={entry.label}>
                  <p className="mn-upcoming__when">{entry.label}</p>
                  <h3 className="mn-upcoming__what">{entry.text}</h3>
                  {entry.date ? (
                    <p className="mn-upcoming__note">
                      <DateTime iso={entry.date} />
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
