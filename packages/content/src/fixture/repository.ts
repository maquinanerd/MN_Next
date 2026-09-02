import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  HomePage,
  LegacyRedirect,
  LiveEvent,
  Page,
  ReadOptions,
  SearchResult,
  SitemapEntry,
  SitemapKind,
  SitemapPage,
  Special,
  Tag,
} from '../domain/types';
import { ContentError } from '../errors';
import { DEFAULT_PER_PAGE, SEARCH_PER_PAGE, type ArticleRelations, type ContentRepository } from '../repository';
import { SITEMAP_PAGE_SIZE } from '../sitemap-page-size';
import {
  fixtureArticles,
  fixtureAuthors,
  fixtureCategories,
  fixtureLiveEvent,
  fixturePoll,
  fixtureRedirects,
  fixtureTags,
  fixtureWatchTitles,
  toSummary,
} from './data';

/**
 * Deterministic provider used by development, unit tests and the visual audit.
 *
 * Loadable only under `CONTENT_SOURCE=fixture`; `env.ts` refuses that in production, and
 * `provider.ts` refuses to construct this class when `NODE_ENV=production` regardless of
 * how the environment was assembled. Two independent guards, because a fixture silently
 * serving readers is the worst failure mode this system has.
 */
export class FixtureContentRepository implements ContentRepository {
  readonly source = 'fixture' as const;

  private readonly articles: Article[];

  constructor(articles: Article[] = fixtureArticles) {
    this.articles = [...articles].sort((a, b) => ((a.publishedAt ?? '') < (b.publishedAt ?? '') ? 1 : -1));
  }

  private published(): Article[] {
    return this.articles.filter((a) => a.status === 'published');
  }

  private paginate<T>(items: T[], page: number, perPage = DEFAULT_PER_PAGE): Page<T> {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * perPage;
    return {
      items: items.slice(start, start + perPage),
      page: current,
      perPage,
      total,
      totalPages,
      hasNext: current < totalPages,
    };
  }

  async getHome(): Promise<HomePage> {
    const all = this.published().map(toSummary);
    const specialLead = all.find((a) => a.category?.slug === 'marvel') ?? all[2] ?? null;
    const byCategory = new Map<string, ArticleSummary[]>();
    for (const a of all.slice(6)) {
      const key = a.category?.slug ?? 'geral';
      const list = byCategory.get(key);
      if (list) list.push(a);
      else byCategory.set(key, [a]);
    }
    return {
      lead: all[0] ?? null,
      secondary: all.slice(1, 4),
      aside: all.slice(4, 6),
      sections: [...byCategory.entries()].slice(0, 4).map(([slug, list]) => ({
        key: slug,
        label: list[0]?.category?.name ?? 'Últimas',
        href: `/${slug}`,
        articles: list.slice(0, 9),
      })),
      mostRead: all.slice(0, 5),
      whereToWatch: fixtureWatchTitles,
      poll: fixturePoll,
      // The three modules the approved front page has and a grid cannot express. The
      // banner's lockup is designed, not derived: "Saga do / Infinito / Explicada" is
      // three weights, and splitting a title on whitespace would break on the next one.
      banner: {
        href: '/especiais/marvel/a-decada-que-apostou-tudo',
        label: 'Documentário',
        title: 'Saga do Infinito Explicada',
        image: all.find((a) => a.cover)?.cover ?? null,
        lockup: { over: 'Saga do', main: 'Infinito', under: 'Explicada' },
        tags: ['Marvel', 'Disney+', 'MCU'],
      },
      special: specialLead ? { slug: 'marvel', name: 'Marvel', lead: specialLead } : null,
      more: all.slice(6, 15),
      updatedAt: all[0]?.updatedAt ?? '2026-08-27T16:05:00-03:00',
    };
  }

  async getArticleBySlug(slug: string, options?: ReadOptions): Promise<Article | null> {
    const pool = options?.preview ? this.articles : this.published();
    return pool.find((a) => a.slug === slug) ?? null;
  }

  async getArticleById(id: string, options?: ReadOptions): Promise<Article | null> {
    const pool = options?.preview ? this.articles : this.published();
    return pool.find((a) => a.id === id) ?? null;
  }

  async getArticle(categorySlug: string, slug: string, options?: ReadOptions): Promise<Article | null> {
    const article = await this.getArticleBySlug(slug, options);
    if (!article) return null;
    if (article.category && article.category.slug !== categorySlug) return null;
    return article;
  }

  async listCategories(): Promise<Category[]> {
    return fixtureCategories;
  }

  async listCategory(slug: string, page: number): Promise<Page<ArticleSummary> & { category: Category }> {
    const category = fixtureCategories.find((c) => c.slug === slug);
    if (!category) throw ContentError.notFound(`category ${slug}`);
    const items = this.published()
      .filter((a) => a.category?.id === category.id)
      .map(toSummary);
    return { ...this.paginate(items, page), category };
  }

  async search(query: string, page: number): Promise<Page<SearchResult>> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return this.paginate<SearchResult>([], page, SEARCH_PER_PAGE);
    const items = this.published()
      .filter((a) => `${a.title} ${a.excerpt}`.toLowerCase().includes(q))
      .map((a) => toSummary(a) as SearchResult);
    return this.paginate(items, page, SEARCH_PER_PAGE);
  }

  async getAuthor(slug: string, page: number): Promise<(Page<ArticleSummary> & { author: Author }) | null> {
    const author = fixtureAuthors.find((a) => a.slug === slug);
    if (!author) return null;
    const items = this.published()
      .filter((a) => a.authors.some((x) => x.id === author.id))
      .map(toSummary);
    return { ...this.paginate(items, page), author };
  }

  async getTag(slug: string, page: number): Promise<(Page<ArticleSummary> & { tag: Tag }) | null> {
    const tag = fixtureTags.find((t) => t.slug === slug);
    if (!tag) return null;
    const items = this.published()
      .filter((a) => a.tags.some((x) => x.id === tag.id))
      .map(toSummary);
    return { ...this.paginate(items, page), tag };
  }

  async listByTemplate(template: 'video' | 'list', page: number): Promise<Page<ArticleSummary>> {
    const items = this.published()
      .filter((a) => a.template === template)
      .map(toSummary);
    return this.paginate(items, page);
  }

  async listReviews(page: number): Promise<Page<ArticleSummary>> {
    const items = this.published()
      .filter((a) => a.seo.schemaType === 'Review' || a.category?.slug === 'reviews')
      .map(toSummary);
    return this.paginate(items, page);
  }

  async listOffers(page: number): Promise<Page<ArticleSummary>> {
    const items = this.published()
      .filter((a) => a.commercial !== undefined)
      .map(toSummary);
    return this.paginate(items, page);
  }

  async getSpecial(slugs: string[]): Promise<Special | null> {
    const franchiseSlug = slugs[0];
    if (!franchiseSlug) return null;
    const category = fixtureCategories.find((c) => c.slug === franchiseSlug && c.parentId === 'cat-especiais');
    if (!category) return null;
    const articles = this.published()
      .filter((a) => a.category?.id === category.id)
      .map(toSummary);
    return {
      franchise: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        cover: articles[0]?.cover ?? null,
        timeline: [
          {
            label: 'Fase 1',
            date: '2008-05-02T00:00:00-03:00',
            text: 'O início do arco, com a primeira aparição do elenco.',
          },
          { label: 'Fase 2', date: '2013-04-25T00:00:00-03:00', text: 'A expansão do universo para fora da Terra.' },
          { label: 'Fase 3', date: '2016-04-28T00:00:00-03:00', text: 'A convergência das linhas narrativas.' },
        ],
      },
      dossiers: [
        {
          id: `${category.id}-dossie`,
          slug: 'a-decada-que-apostou-tudo',
          franchiseId: category.id,
          title: 'A década que apostou tudo',
          kicker: category.name,
          cover: articles[0]?.cover ?? null,
          chapters: [
            { id: 'cap-1', title: 'O plano de dez anos', blocks: [] },
            { id: 'cap-2', title: 'O pós-crédito que ninguém entendeu', blocks: [] },
          ],
        },
      ],
      articles,
      liveEvent: null,
    };
  }

  async listSpecials(): Promise<Special[]> {
    const roots = fixtureCategories.filter((c) => c.parentId === 'cat-especiais');
    const list = await Promise.all(roots.map((c) => this.getSpecial([c.slug])));
    return list.filter((s): s is Special => s !== null);
  }

  async getLiveEvent(slug: string): Promise<LiveEvent | null> {
    return slug === fixtureLiveEvent.slug ? fixtureLiveEvent : null;
  }

  async countSitemapPages(): Promise<number> {
    return Math.max(1, Math.ceil(this.published().length / SITEMAP_PAGE_SIZE));
  }

  async listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage> {
    const entries: SitemapEntry[] =
      kind === 'categories'
        ? fixtureCategories.map((c) => ({ path: `/${c.slug}`, lastModified: '2026-08-27T16:05:00-03:00' }))
        : kind === 'tags'
          ? fixtureTags.map((t) => ({ path: `/tag/${t.slug}`, lastModified: '2026-08-27T16:05:00-03:00' }))
          : kind === 'authors'
            ? fixtureAuthors.map((a) => ({ path: `/autor/${a.slug}`, lastModified: '2026-08-27T16:05:00-03:00' }))
            : this.published()
                .filter((a) => a.category !== null)
                .map((a) => ({
                  path: `/${a.category?.slug}/${a.slug}`,
                  lastModified: a.updatedAt,
                  title: a.title,
                  ...(a.publishedAt ? { publishedAt: a.publishedAt } : {}),
                }));

    // Article sitemaps are paginated by 1-based page number, exactly as the Kal El
    // provider does — a page past the end must be empty so the route can answer 404.
    if (kind !== 'articles') return { entries, nextCursor: null };
    const page = Math.max(1, Number(cursor ?? 1) || 1);
    const start = (page - 1) * SITEMAP_PAGE_SIZE;
    const slice = entries.slice(start, start + SITEMAP_PAGE_SIZE);
    return { entries: slice, nextCursor: start + SITEMAP_PAGE_SIZE < entries.length ? String(page + 1) : null };
  }

  async listRecentNews(since: Date, limit: number): Promise<ArticleSummary[]> {
    return this.published()
      .filter((a) => a.publishedAt !== null && new Date(a.publishedAt) >= since)
      .slice(0, limit)
      .map(toSummary);
  }

  async listRedirects(): Promise<LegacyRedirect[]> {
    return fixtureRedirects;
  }

  async relationsFor(articleId: string): Promise<ArticleRelations> {
    const article = this.articles.find((a) => a.id === articleId);
    if (!article) return { categories: [], tags: [], authors: [] };
    return {
      categories: article.category ? [article.category.slug] : [],
      tags: article.tags.map((t) => t.slug),
      authors: article.authors.map((a) => a.slug),
    };
  }
}
