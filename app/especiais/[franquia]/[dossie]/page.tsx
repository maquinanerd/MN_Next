import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { ArticleBody, Breadcrumbs, ChapterNav, Dossier, MnImage, SIZES } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata, absolute } from '@mn/seo';

import { repo } from '../../../../lib/content';
import { seoContext } from '../../../../lib/seo-context';

/** Dossier at `/especiais/{franquia}/{dossie}`. */
export const revalidate = 300;

type Params = { franquia: string; dossie: string };

async function load(params: Params) {
  const franquia = safeSlugParam(params.franquia);
  const dossie = safeSlugParam(params.dossie);
  if (!franquia || !dossie) return null;
  const special = await repo().getSpecial([franquia, dossie]);
  if (!special) return null;
  const dossier = special.dossiers.find((d) => d.slug === dossie);
  if (!dossier) return null;
  return { special, dossier, franquia, dossie };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const loaded = await load(await params).catch(() => null);
  if (!loaded) return { title: 'Dossiê não encontrado', robots: { index: false } };
  return listingMetadata(seoContext(), {
    title: loaded.dossier.title,
    description: `${loaded.dossier.kicker}: ${loaded.dossier.title}`,
    path: `/especiais/${loaded.franquia}/${loaded.dossie}`,
    image: loaded.dossier.cover,
  });
}

export default async function DossierPage({ params }: { params: Promise<Params> }) {
  const loaded = await load(await params);
  if (!loaded) notFound();
  const { special, dossier, franquia, dossie } = loaded;

  const ctx = seoContext();
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Especiais', href: '/especiais' },
    { label: special.franchise.name, href: `/especiais/${franquia}` },
    { label: dossier.title },
  ];
  const url = absolute(ctx, `/especiais/${franquia}/${dossie}`);

  const graph = buildGraph(ctx, [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: dossier.title,
      url,
      isPartOf: { '@id': `${ctx.siteUrl}/#website` },
      publisher: { '@id': `${ctx.siteUrl}/#organization` },
      inLanguage: 'pt-BR',
    },
    breadcrumbNode(ctx, crumbs),
  ]);

  return (
    <>
      <JsonLd graph={graph} />

      <header className="mn-longform__cover">
        {dossier.cover ? <MnImage image={dossier.cover} alt="" sizes={SIZES.full} priority /> : null}
        <span className="mn-longform__scrim" aria-hidden="true" />
        <Dossier>
          <div className="mn-longform__inner">
            <p className="mn-longform__kickers">
              <span>{dossier.kicker}</span>
            </p>
            <h1 className="mn-longform__title">{dossier.title}</h1>
          </div>
        </Dossier>
      </header>

      <Dossier>
        <Breadcrumbs items={crumbs} />

        {dossier.chapters.length === 0 ? (
          <p className="mn-state__text" style={{ paddingBlock: 48 }}>
            Os capítulos deste dossiê ainda estão sendo publicados.
          </p>
        ) : (
          <div className="mn-dossier__chapters">
            <div style={{ position: 'sticky', top: 24 }}>
              <ChapterNav chapters={dossier.chapters} />
            </div>
            <div>
              {dossier.chapters.map((chapter) => (
                <section key={chapter.id} id={chapter.id} style={{ marginBottom: 64, scrollMarginTop: 96 }}>
                  <h2 className="mn-article__title" style={{ fontSize: 'var(--fs-h2)' }}>
                    {chapter.title}
                  </h2>
                  <ArticleBody blocks={chapter.blocks} showAds={false} />
                </section>
              ))}
            </div>
          </div>
        )}
      </Dossier>
    </>
  );
}
