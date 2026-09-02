import Link from 'next/link';
import type { Metadata } from 'next';
import { CATEGORY_SLUGS, CATEGORIES } from '@mn/content';
import {
  AdSlot,
  AD_SLOTS,
  ArticleCard,
  ArticleGrid,
  Editorial,
  MnImage,
  MostRead,
  NewsletterForm,
  SIZES,
  SectionHeading,
  Shell,
  WhereToWatch,
  articleHref,
  AuthorByline,
  HomeBannerBand,
  HomeSpecialFeature,
  HomeMoreGrid,
} from '@mn/ui';
import { JsonLd, buildGraph, collectionNode } from '@mn/seo';

import { repo } from '../lib/content';
import { seoContext } from '../lib/seo-context';
import { HomePoll } from '../components/HomePoll';

/**
 * Home.
 *
 * ISR at 60 seconds plus `revalidateTag('home')` on publication (docs/08): the short
 * window bounds staleness if a webhook is ever missed, and the tag makes a breaking
 * story appear immediately rather than up to a minute late.
 */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const ctx = seoContext();
  return {
    title: 'Máquina Nerd — cinema, séries, quadrinhos, games e animes',
    alternates: { canonical: `${ctx.siteUrl}/` },
  };
}

export default async function HomePage() {
  const ctx = seoContext();
  const home = await repo().getHome();
  // Every summary the repository returns has a desk, so a href is always available; the
  // fallback keeps this honest if that ever changes.
  const leadHref = home.lead ? (articleHref(home.lead) ?? '/') : '/';

  const graph = buildGraph(ctx, [
    collectionNode(ctx, {
      name: 'Máquina Nerd',
      description: 'Notícias de cinema, séries, quadrinhos, games e animes.',
      url: `${ctx.siteUrl}/`,
      items: [home.lead, ...home.secondary].filter((a): a is NonNullable<typeof a> => a !== null),
    }),
  ]);

  return (
    <>
      <JsonLd graph={graph} />

      <Shell>
        <h1 className="mn-visually-hidden">Máquina Nerd — notícias de cinema, séries, quadrinhos, games e animes</h1>
        <section className="mn-home__hero" aria-label="Destaques">
          <div>
            {home.lead ? (
              <div className="mn-home__lead">
                <div className="mn-home__leadtext">
                  {home.lead.category ? (
                    <Link className="mn-card__kicker mn-kicker--pill" href={`/${home.lead.category.slug}`}>
                      {home.lead.category.name}
                    </Link>
                  ) : null}
                  <h2>
                    <Link href={leadHref}>{home.lead.title}</Link>
                  </h2>
                  <AuthorByline
                    authors={home.lead.authors}
                    date={home.lead.publishedAt ?? home.lead.updatedAt}
                    suffix={`${home.lead.readingMinutes} min`}
                  />
                  <p className="mn-card__excerpt">
                    {home.lead.excerpt} <Link href={leadHref}>Ler mais</Link>
                  </p>
                </div>
                {home.lead.cover ? (
                  <Link className="mn-home__leadmedia" href={leadHref} tabIndex={-1} aria-hidden="true">
                    <MnImage image={home.lead.cover} alt="" sizes={SIZES.hero} priority />
                  </Link>
                ) : null}
              </div>
            ) : null}

            {home.secondary.length > 0 ? (
              <div className="mn-home__secondary">
                {home.secondary.slice(0, 2).map((article) => (
                  <ArticleCard key={article.id} article={article} size="lg" showExcerpt showKicker={false} />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="mn-home__aside" aria-label="Mais destaques">
            {home.aside[0] ? <ArticleCard article={home.aside[0]} size="md" showMeta /> : null}
            <AdSlot id="ad-home-sidebar" {...AD_SLOTS.sidebar} sticky targeting={{ brand: 'mn', template: 'home' }} />
          </aside>
        </section>
      </Shell>

      <Shell>
        <div className="mn-section--tight">
          <AdSlot id="ad-home-leaderboard" {...AD_SLOTS.leaderboard} targeting={{ brand: 'mn', template: 'home' }} />
        </div>
      </Shell>

      {/*
       * The full-width band, third module on the approved front page.
       *
       * Its absence was the single largest departure from the design: the page went from
       * hero to grid to grid with nothing to break the rhythm, which is what made it read
       * as a wireframe rather than as a front page.
       */}
      {home.banner ? (
        <Shell>
          <div className="mn-section">
            <HomeBannerBand banner={home.banner} />
          </div>
        </Shell>
      ) : null}

      {home.sections[0] ? (
        <Shell>
          <section className="mn-section" aria-label={home.sections[0].label}>
            <SectionHeading label={home.sections[0].label} href={home.sections[0].href} />
            <ArticleGrid articles={home.sections[0].articles.slice(0, 3)} columns={3} showExcerpt />
          </section>
        </Shell>
      ) : null}

      <Shell>
        <div className="mn-section">
          <WhereToWatch titles={home.whereToWatch} />
        </div>
      </Shell>

      {home.poll ? (
        <Shell>
          <div className="mn-section">
            <SectionHeading label="Enquete" />
            <HomePoll poll={home.poll} />
          </div>
        </Shell>
      ) : null}

      {home.sections[1] ? (
        <Shell>
          <section className="mn-section" aria-label={home.sections[1].label}>
            <SectionHeading label={home.sections[1].label} href={home.sections[1].href} />
            <ArticleGrid articles={home.sections[1].articles.slice(0, 4)} columns={4} size="sm" showMeta={false} />
          </section>
        </Shell>
      ) : null}

      {home.special ? (
        <Shell>
          <HomeSpecialFeature special={home.special} />
        </Shell>
      ) : null}

      <section className="mn-videoband" aria-label="Galeria de vídeos">
        <Shell>
          <SectionHeading label="Galeria de vídeos" tone="dark" href="/videos" linkLabel="Mais vídeos" />
          <div className="mn-videoband__grid">
            {home.sections[2]?.articles[0] ? (
              <ArticleCard article={home.sections[2].articles[0]} size="lg" showExcerpt headingLevel="h3" />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(home.sections[2]?.articles ?? []).slice(1, 3).map((article) => (
                <ArticleCard key={article.id} article={article} size="sm" layout="horizontal" showMeta={false} />
              ))}
            </div>
          </div>
        </Shell>
      </section>

      <Shell>
        <section className="mn-section" aria-label="Mais lidas">
          <SectionHeading label="Mais lidas" />
          <MostRead items={home.mostRead} />
        </section>
      </Shell>

      {home.more.length > 0 ? (
        <Shell>
          <HomeMoreGrid label="Mais, mais, mais" articles={home.more} />
        </Shell>
      ) : null}

      {home.sections[3] ? (
        <Shell>
          <section className="mn-section" aria-label={home.sections[3].label}>
            <SectionHeading label={home.sections[3].label} href={home.sections[3].href} />
            <ArticleGrid articles={home.sections[3].articles} columns={3} size="sm" />
          </section>
        </Shell>
      ) : null}

      <Editorial>
        <section className="mn-section" aria-label="Editorias">
          <SectionHeading label="Editorias" />
          <div className="mn-grid mn-grid--3">
            {CATEGORY_SLUGS.map((slug) => (
              <Link className="mn-card" key={slug} href={`/${slug}`}>
                <span className="mn-card__kicker">Editoria</span>
                <span className="mn-card__title">{CATEGORIES[slug].name}</span>
              </Link>
            ))}
          </div>
        </section>
      </Editorial>

      <Editorial>
        <section className="mn-section" aria-label="Newsletter">
          <div className="mn-newsletter">
            <span className="mn-newsletter__eyebrow">Toda sexta</span>
            <h2 className="mn-newsletter__title">A semana nerd em 5 minutos</h2>
            <p className="mn-wheretowatch__intro">
              O que importou em cinema, séries, quadrinhos e games, sem enrolação. Cancele quando quiser.
            </p>
            <NewsletterForm />
          </div>
        </section>
      </Editorial>
    </>
  );
}
