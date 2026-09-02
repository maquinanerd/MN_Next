import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORIES, CATEGORY_SLUGS, type ArticleSummary, type Category, isContentError } from '@mn/content';
import {
  AdSlot,
  AD_SLOTS,
  ArticleCard,
  ArticleGrid,
  Breadcrumbs,
  CategoryTabs,
  Editorial,
  EmptyState,
  MostRead,
  NewsletterForm,
  Pagination,
  SectionHeading,
  Shell,
  DateTime,
} from '@mn/ui';
import { JsonLd, buildGraph, collectionNode, breadcrumbNode, listingMetadata, absolute } from '@mn/seo';

import { optional, repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/** The desk tabs, from the editorial map rather than from whatever the CMS happens to have. */
function slugToTabs() {
  return CATEGORY_SLUGS.map((slug) => ({ slug, name: CATEGORIES[slug].name }));
}

/**
 * Shared implementation for `/{categoria}` and `/{categoria}/page/{n}`.
 *
 * Both routes exist because both must be real, indexable URLs with their own canonical -
 * page 2 pointing at page 1 is how an archive disappears from search (docs/06).
 */

export interface CategoryData {
  category: Category;
  items: ArticleSummary[];
  page: number;
  /** How many the desk holds in total; null when the source cannot say. */
  total: number | null;
  totalPages: number | null;
  hasNext: boolean;
  mostRead: ArticleSummary[] | null;
}

export async function loadCategory(slug: string, page: number): Promise<CategoryData> {
  try {
    const result = await repo().listCategory(slug, page);
    // A page past the end is a 404, not an empty archive page that competes in search.
    if (page > 1 && result.items.length === 0) notFound();
    const mostRead = await optional(
      repo()
        .getHome()
        .then((home) => home.mostRead.slice(0, 5)),
      'category-most-read',
    );
    return {
      category: result.category,
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      mostRead,
    };
  } catch (err) {
    if (isContentError(err) && err.kind === 'not_found') notFound();
    throw err;
  }
}

export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const ctx = seoContext();
  try {
    const result = await repo().listCategory(slug, page);
    return listingMetadata(ctx, {
      title: `${result.category.name} — notícias e análises`,
      description: result.category.description || `Tudo sobre ${result.category.name} no Máquina Nerd.`,
      path: `/${slug}`,
      page,
      image: result.items[0]?.cover ?? null,
    });
  } catch {
    return { title: 'Editoria não encontrada', robots: { index: false, follow: true } };
  }
}

export function CategoryView({ data, page }: { data: CategoryData; page: number }) {
  const ctx = seoContext();
  const { category, items } = data;
  const url = absolute(ctx, page > 1 ? `/${category.slug}/page/${page}` : `/${category.slug}`);
  const crumbs = [{ label: 'Home', href: '/' }, { label: category.name }];
  const subs = (CATEGORIES[category.slug as keyof typeof CATEGORIES]?.subs ?? []) as readonly string[];

  const graph = buildGraph(ctx, [
    collectionNode(ctx, {
      name: category.name,
      description: category.description,
      url,
      items,
    }),
    breadcrumbNode(ctx, crumbs),
  ]);

  const [hero, ...rest] = items;

  /*
   * The second figure is the date of the newest item, not a count of today's.
   *
   * "Hoje" was countable only in appearance: this view holds one page, so from page two
   * onward the answer was always zero, it read `updatedAt` and so counted a correction
   * as a publication, and it used the server's midnight rather than São Paulo's. The
   * newest publication date answers the same question — is this desk alive — and is
   * exactly right from the first item, because the listing is ordered by date.
   */
  const newest = items.find((a) => a.publishedAt !== null)?.publishedAt ?? null;

  return (
    <>
      <JsonLd graph={graph} />

      <CategoryTabs items={slugToTabs()} activeSlug={category.slug} />

      <Shell>
        <div className="mn-section--tight">
          <AdSlot
            id="ad-category-leaderboard"
            {...AD_SLOTS.leaderboard}
            targeting={{ brand: 'mn', categoria: category.slug, template: 'categoria' }}
          />
        </div>
      </Shell>

      <Editorial>
        <Breadcrumbs items={crumbs} />

        <header className="mn-cathead">
          <div className="mn-cathead__row">
            <div className="mn-cathead__lede">
              <h1 className="mn-cathead__title">{category.name}</h1>
              {category.description ? <p className="mn-cathead__desc">{category.description}</p> : null}
            </div>
            {/*
             * The pair of figures the design puts beside the desk title. Counted, not
             * invented: the prototype's second cell is "hoje", and that is genuinely
             * knowable, unlike the visit counts it shows further down the page.
             */}
            {/* The term precedes its definition in the markup, as the spec requires;
                the design's order — figure above label — is done in CSS. */}
            <dl className="mn-cathead__stats">
              <div className="mn-cathead__stat">
                <dt className="mn-cathead__statlabel">Matérias</dt>
                <dd className="mn-cathead__statvalue">
                  {data.total === null ? '—' : data.total.toLocaleString('pt-BR')}
                </dd>
              </div>
              {newest ? (
                <div className="mn-cathead__stat">
                  <dt className="mn-cathead__statlabel">Última</dt>
                  <dd className="mn-cathead__statvalue">
                    <DateTime iso={newest} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          {subs.length > 0 ? (
            <nav className="mn-cathead__subs" aria-label={`Assuntos de ${category.name}`}>
              {subs.map((sub) => (
                <a className="mn-tag" key={sub} href={`/tag/${sub.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  {sub}
                </a>
              ))}
            </nav>
          ) : null}
        </header>

        {items.length === 0 ? (
          <div style={{ paddingBlock: 48 }}>
            <EmptyState
              title="Ainda não há matérias nesta editoria"
              description="Assim que a redação publicar algo aqui, esta página é atualizada automaticamente."
              action={{ label: 'Ver a home', href: '/' }}
            />
          </div>
        ) : (
          <>
            {page === 1 && hero ? (
              <section className="mn-hero-editorial" aria-label="Destaque da editoria">
                <ArticleCard article={hero} size="hero" showExcerpt headingLevel="h2" priority />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {rest.slice(0, 3).map((article) => (
                    <ArticleCard key={article.id} article={article} size="sm" layout="horizontal" showMeta={false} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mn-listing">
              <div>
                <SectionHeading label="Todas as matérias" as="h2" />
                <ArticleGrid articles={page === 1 ? rest.slice(3) : items} columns={3} showExcerpt />
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  hasNext={data.hasNext}
                  hrefFor={(n) => (n === 1 ? `/${category.slug}` : `/${category.slug}/page/${n}`)}
                />
              </div>

              <aside className="mn-listing__aside" aria-label="Complementos">
                {data.mostRead && data.mostRead.length > 0 ? (
                  <div>
                    <p className="mn-sectionheading__label" style={{ marginBottom: 16 }}>
                      Mais lidas em {category.name}
                    </p>
                    <MostRead items={data.mostRead} />
                  </div>
                ) : null}
                <AdSlot id="ad-category-sidebar" {...AD_SLOTS.sidebar} sticky />
                <div className="mn-newsletter">
                  <span className="mn-newsletter__eyebrow">Toda sexta</span>
                  <h2 className="mn-newsletter__title" style={{ fontSize: 'var(--fs-h4)' }}>
                    A semana nerd em 5 minutos
                  </h2>
                  <NewsletterForm />
                </div>
              </aside>
            </div>
          </>
        )}
      </Editorial>
    </>
  );
}

export { CATEGORY_SLUGS };
