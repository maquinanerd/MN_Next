import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  LegacyRedirect,
  Page,
  ReadOptions,
  SearchResult,
  SitemapEntry,
  SitemapKind,
  SitemapPage,
  Tag,
} from '../domain/types';
import { ContentError } from '../errors';
import { articlePath, isReservedTag } from '../paths';
import {
  SEARCH_PER_PAGE,
  byPublishedDesc,
  windowOffsets,
  type ArticleRelations,
  type ContentRepository,
  type ListWindow,
} from '../repository';
import { SITEMAP_PAGE_SIZE } from '../sitemap-page-size';
import {
  FIXTURE_NOW_ISO,
  fixtureArticles,
  fixtureAuthors,
  fixtureCategories,
  fixtureDraft,
  fixtureRedirects,
  fixtureTags,
  toSummary,
} from './data';

/** The instant fixture dates are relative to, so "2 horas atrás" is stable in a screenshot. */
export const FIXTURE_NOW = new Date(FIXTURE_NOW_ISO);

/**
 * Deterministic provider for development, tests and the visual audit.
 *
 * Loadable only under `CONTENT_SOURCE=fixture`; `env.ts` refuses that in production and
 * staging, and `provider.ts` refuses to construct this class there even if the
 * environment were assembled some other way. Two guards, because a fixture silently
 * serving readers is the worst failure this system has.
 */
export class FixtureContentRepository implements ContentRepository {
  readonly source = 'fixture' as const;

  private readonly articles: Article[];

  constructor(articles: Article[] = [...fixtureArticles, fixtureDraft]) {
    this.articles = [...articles].sort(byPublishedDesc);
  }

  private published(): Article[] {
    return this.articles.filter((a) => a.status === 'published');
  }

  private paginate<T>(items: T[], page: number, window?: ListWindow): Page<T> {
    const { perPage, skip, offset } = windowOffsets(page, window);
    const total = Math.max(0, items.length - skip);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    return {
      items: items.slice(offset, offset + perPage),
      page,
      perPage,
      total,
      totalPages,
      hasNext: offset + perPage < items.length,
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
    if (!article || !article.category || article.category.slug !== categorySlug) return null;
    return article;
  }

  async listLatest(page: number, window?: ListWindow): Promise<Page<ArticleSummary>> {
    return this.paginate(this.published().map(toSummary), page, window);
  }

  async listCategory(
    slug: string,
    page: number,
    window?: ListWindow,
  ): Promise<Page<ArticleSummary> & { category: Category }> {
    const category = fixtureCategories.find((c) => c.slug === slug);
    if (!category) throw ContentError.notFound(`category ${slug}`);
    const items = this.published()
      .filter((a) => a.category?.id === category.id)
      .map(toSummary);
    return { ...this.paginate(items, page, window), category };
  }

  async listCategories(): Promise<Category[]> {
    return fixtureCategories;
  }

  async findTags(slugs: readonly string[]): Promise<Tag[]> {
    const wanted = new Set(slugs);
    return fixtureTags.filter((t) => wanted.has(t.slug));
  }

  async listOffers(page: number, window?: ListWindow): Promise<Page<ArticleSummary>> {
    return this.paginate(
      this.published()
        .filter((a) => a.layout === 'offer')
        .map(toSummary),
      page,
      window,
    );
  }

  async search(query: string, page: number): Promise<Page<SearchResult>> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return this.paginate<SearchResult>([], page, { perPage: SEARCH_PER_PAGE });
    const items = this.published()
      .filter((a) => `${a.title} ${a.excerpt}`.toLowerCase().includes(q))
      .map((a) => toSummary(a) as SearchResult);
    return this.paginate(items, page, { perPage: SEARCH_PER_PAGE });
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
    const tag = fixtureTags.find((x) => x.slug === slug);
    if (!tag) return null;
    const items = this.published()
      .filter((a) => a.tags.some((x) => x.id === tag.id))
      .map(toSummary);
    return { ...this.paginate(items, page), tag };
  }

  async countSitemapPages(): Promise<number> {
    return Math.max(1, Math.ceil(this.published().length / SITEMAP_PAGE_SIZE));
  }

  async listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage> {
    const stamp = FIXTURE_NOW_ISO;
    if (kind === 'categories') {
      return { entries: fixtureCategories.map((c) => ({ path: `/${c.slug}`, lastModified: stamp })), nextCursor: null };
    }
    if (kind === 'tags') {
      return {
        entries: fixtureTags
          .filter((x) => !isReservedTag(x.slug))
          .map((x) => ({ path: `/tag/${x.slug}`, lastModified: stamp })),
        nextCursor: null,
      };
    }
    if (kind === 'authors') {
      return {
        entries: fixtureAuthors.map((a) => ({ path: `/autor/${a.slug}`, lastModified: stamp })),
        nextCursor: null,
      };
    }
    const entries: SitemapEntry[] = this.published()
      .map((a): SitemapEntry | null => {
        const path = articlePath(a);
        if (!path) return null;
        return {
          path,
          lastModified: a.updatedAt,
          title: a.title,
          ...(a.publishedAt ? { publishedAt: a.publishedAt } : {}),
        };
      })
      .filter((e): e is SitemapEntry => e !== null);
    const page = Math.max(1, Number(cursor ?? 1) || 1);
    const start = (page - 1) * SITEMAP_PAGE_SIZE;
    return {
      entries: entries.slice(start, start + SITEMAP_PAGE_SIZE),
      nextCursor: start + SITEMAP_PAGE_SIZE < entries.length ? String(page + 1) : null,
    };
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
      tags: article.tags.map((x) => x.slug),
      authors: article.authors.map((a) => a.slug),
    };
  }
}
