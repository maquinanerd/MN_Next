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
  SitemapKind,
  SitemapPage,
  Special,
  Tag,
} from './domain/types';

/**
 * The contract every route consumes.
 *
 * Deliberately narrow and shaped like the site's URLs, not like the CMS: a page asks for
 * "the article at /series/resident-evil", never for "article by uuid with these joins".
 * Swapping the backing CMS is a matter of writing one more implementation.
 */
export interface ContentRepository {
  readonly source: 'kalel' | 'fixture';

  getHome(): Promise<HomePage>;
  getArticle(categorySlug: string, slug: string, options?: ReadOptions): Promise<Article | null>;
  /** Slug-only lookup, for routes that are not category-scoped (reviews, offers). */
  getArticleBySlug(slug: string, options?: ReadOptions): Promise<Article | null>;
  getArticleById(id: string, options?: ReadOptions): Promise<Article | null>;

  listCategory(slug: string, page: number): Promise<Page<ArticleSummary> & { category: Category }>;
  listCategories(): Promise<Category[]>;

  search(query: string, page: number): Promise<Page<SearchResult>>;

  getAuthor(slug: string, page: number): Promise<(Page<ArticleSummary> & { author: Author }) | null>;
  getTag(slug: string, page: number): Promise<(Page<ArticleSummary> & { tag: Tag }) | null>;

  /** `slugs` is the `/especiais/[franquia]/[dossie]` path, most significant first. */
  getSpecial(slugs: string[]): Promise<Special | null>;
  listSpecials(): Promise<Special[]>;
  getLiveEvent(slug: string): Promise<LiveEvent | null>;

  listByTemplate(template: 'video' | 'list', page: number): Promise<Page<ArticleSummary>>;
  listReviews(page: number): Promise<Page<ArticleSummary>>;
  listOffers(page: number): Promise<Page<ArticleSummary>>;

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
   * The taxonomy an article belongs to, for targeted cache invalidation.
   *
   * The publication webhook carries only an article id, so the desk, tag and author
   * archives it appears in have to be resolved before their cache tags can be purged.
   */
  relationsFor(articleId: string): Promise<ArticleRelations>;
}

export interface ArticleRelations {
  categories: string[];
  tags: string[];
  authors: string[];
}

export const DEFAULT_PER_PAGE = 12;
export const SEARCH_PER_PAGE = 12;

export function emptyPage<T>(page: number, perPage = DEFAULT_PER_PAGE): Page<T> {
  return { items: [], page, perPage, total: 0, totalPages: 0, hasNext: false };
}
