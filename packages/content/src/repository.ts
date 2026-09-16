import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  LegacyRedirect,
  Page,
  ReadOptions,
  SearchResult,
  SitemapKind,
  SitemapPage,
  Tag,
} from './domain/types';

/**
 * The contract every route consumes.
 *
 * Shaped like the site's URLs, not like the CMS: a page asks for "the article at
 * /cinema/slug" or "the newest page of Games", never for "article by uuid with these
 * joins". Swapping the backing CMS is writing one more implementation of this.
 *
 * Every listing is **newest first by publication date**. That is the order a news site
 * reads in, and it is not the order a CMS stores in: an imported archive is written in a
 * single afternoon, so "most recently updated" would put a migration batch on the front
 * page. The Kal El implementation asks the CMS for publication order explicitly.
 */
export interface ContentRepository {
  readonly source: 'kalel' | 'fixture';

  getArticle(categorySlug: string, slug: string, options?: ReadOptions): Promise<Article | null>;
  /** Slug-only lookup, for routes that are not editoria-scoped (offers, legacy URLs). */
  getArticleBySlug(slug: string, options?: ReadOptions): Promise<Article | null>;
  getArticleById(id: string, options?: ReadOptions): Promise<Article | null>;

  /** Everything, across every editoria — the home feed and `/page/{n}`. */
  listLatest(page: number, window?: ListWindow): Promise<Page<ArticleSummary>>;
  listCategory(slug: string, page: number, window?: ListWindow): Promise<Page<ArticleSummary> & { category: Category }>;
  listCategories(): Promise<Category[]>;
  listOffers(page: number, window?: ListWindow): Promise<Page<ArticleSummary>>;
  /**
   * The tags with these exact slugs, the ones that exist. Never the whole vocabulary: an
   * imported archive has tens of thousands of tags, and no page shows more than a handful.
   */
  findTags(slugs: readonly string[]): Promise<Tag[]>;

  search(query: string, page: number): Promise<Page<SearchResult>>;

  getAuthor(slug: string, page: number): Promise<(Page<ArticleSummary> & { author: Author }) | null>;
  getTag(slug: string, page: number): Promise<(Page<ArticleSummary> & { tag: Tag }) | null>;

  /**
   * One sitemap file. For `articles`, `cursor` is the 1-based page number — an opaque
   * cursor cannot be enumerated, and a sitemap index has to name every child file.
   */
  listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage>;
  /** How many article sitemap files exist, so the index can declare all of them. */
  countSitemapPages(): Promise<number>;
  listRecentNews(since: Date, limit: number): Promise<ArticleSummary[]>;

  listRedirects(): Promise<LegacyRedirect[]>;

  /**
   * The taxonomy an article belongs to, for targeted cache invalidation. The publication
   * webhook carries only an article id, so the archives it appears in have to be resolved
   * before their cache tags can be purged.
   */
  relationsFor(articleId: string): Promise<ArticleRelations>;
}

export interface ArticleRelations {
  categories: string[];
  tags: string[];
  authors: string[];
}

/**
 * Which slice of a listing a page shows.
 *
 * `skip` exists because the editoria and the home spend their first items on the opening
 * (lead, three overlays, four side items) and then paginate what remains; without it,
 * page 2 would begin with stories the reader already saw at the top of page 1.
 */
export interface ListWindow {
  perPage?: number;
  skip?: number;
}

export function windowOffsets(
  page: number,
  window: ListWindow = {},
): { perPage: number; skip: number; offset: number } {
  const perPage = window.perPage ?? DEFAULT_PER_PAGE;
  const skip = window.skip ?? 0;
  return { perPage, skip, offset: skip + (Math.max(1, page) - 1) * perPage };
}

export const DEFAULT_PER_PAGE = 12;
export const SEARCH_PER_PAGE = 12;

export function emptyPage<T>(page: number, perPage = DEFAULT_PER_PAGE): Page<T> {
  return { items: [], page, perPage, total: 0, totalPages: 0, hasNext: false };
}

/** Newest publication first; an unpublished item (preview only) sorts last. */
export function byPublishedDesc(
  a: Pick<ArticleSummary, 'publishedAt' | 'id'>,
  b: Pick<ArticleSummary, 'publishedAt' | 'id'>,
): number {
  const pa = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
  const pb = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
  if (pa !== pb) return pb - pa;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
