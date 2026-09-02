import 'server-only';

import { z } from 'zod';

import { TAG, REVALIDATE, articleSlugTag, articleTag, authorTag, categoryTag, specialTag, tagTag } from '../cache-tags';
import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  HomePage,
  Image,
  LegacyRedirect,
  LiveEvent,
  Page,
  ReadOptions,
  SearchResult,
  SitemapEntry,
  SitemapKind,
  SitemapPage,
  Special,
  Tag as DomainTag,
} from '../domain/types';
import { ContentError } from '../errors';
import {
  DEFAULT_PER_PAGE,
  SEARCH_PER_PAGE,
  type ArticleRelations,
  type ContentRepository,
  emptyPage,
} from '../repository';
import { isValidSlug } from '../slug';
import { getCinerieTitles } from '../cinerie/client';
import {
  kalelArticleListSchema,
  kalelArticleSchema,
  kalelAuthorSchema,
  kalelCategorySchema,
  kalelEntitySchema,
  kalelMediaListSchema,
  kalelMediaSchema,
  kalelRedirectSchema,
  kalelTagSchema,
  type KalElArticleSummary,
  type KalElEntity,
} from './dto';
import {
  defaultMediaUrl,
  mapArticle,
  mapArticleSummary,
  mapAuthor,
  mapCategory,
  mapMedia,
  mapTag,
  type MapperContext,
} from './mapper';
import { KalElTransport } from './transport';
import { SITEMAP_PAGE_SIZE } from '../sitemap-page-size';

/**
 * Production content provider.
 *
 * Three properties of the real Kal El API shape this file:
 *
 *  1. **There is no public delivery endpoint.** Every read is authenticated with the
 *     server-only service token, so nothing here may run in a client component;
 *     `server-only` enforces that at build time.
 *  2. **Article lookup is by id, plus the `slug` filter added by the companion Kal El
 *     change.** Because the list query is not `.strict()`, an instance without that
 *     change silently ignores the parameter and answers with the newest article — so the
 *     result is always re-checked against the requested slug, and a mismatch falls back
 *     to the complete published index. Correct on both, one round trip on the patched one.
 *  3. **Media pages by `limit`/`offset` with a `total`, articles page by cursor.** Two
 *     different pagination models in one API; conflating them truncates the media index
 *     to its first page and makes older covers vanish.
 */

/** Articles page by cursor at 100 per call; 500 pages is a 50k-article ceiling. */
const INDEX_PAGE_SIZE = 100;
const MAX_INDEX_PAGES = 500;

/** How far back the news walk will page before giving up. 1000 articles is the cap. */
const MAX_NEWS_PAGES = 10;

/** Media pages by offset; Kal El caps `limit` at 200. */
/**
 * Tags that mark an article as worth the full-width band.
 *
 * Reserved tags, not a field: the CMS has no dossier model, so promotion to the banner
 * is an editorial convention the newsroom can apply from the tag picker. Changing this
 * set is changing one line, which is the point of keeping it here rather than in code
 * scattered across the page.
 */
const BANNER_TAGS = new Set(['especial', 'dossie', 'documentario']);

/** Desks whose articles can lead the franchise feature. */
const SPECIAL_DESKS = new Set(['especiais', 'marvel', 'star-wars', 'dc']);

/** Where an article lives. Null when it has no desk, which means it has no public URL. */
function articlePath(article: ArticleSummary): string | null {
  return article.category ? `/${article.category.slug}/${article.slug}` : null;
}

const MEDIA_PAGE_SIZE = 200;
const MAX_MEDIA_PAGES = 200;

interface CursorWindow {
  items: KalElArticleSummary[];
  hasNext: boolean;
}

/** One published article, reduced to what slug resolution and the sitemaps need. */
interface IndexEntry {
  id: string;
  slug: string;
  categoryId: string | null;
  updatedAt: string;
  publishedAt: string | null;
  title: string;
}

export interface KalElRepositoryOptions {
  transport?: KalElTransport;
  mediaUrl?: (mediaId: string) => string;
  now?: () => Date;
}

export class KalElContentRepository implements ContentRepository {
  readonly source = 'kalel' as const;
  private readonly transport: KalElTransport;
  private readonly mediaUrl: (mediaId: string) => string;
  private readonly now: () => Date;

  constructor(opts: KalElRepositoryOptions = {}) {
    this.transport = opts.transport ?? KalElTransport.fromEnv();
    this.mediaUrl = opts.mediaUrl ?? defaultMediaUrl;
    this.now = opts.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------- taxonomy

  private async fetchCategories(): Promise<Category[]> {
    const rows = await this.transport.read(z.array(kalelCategorySchema), {
      path: this.transport.sitePath('/categories'),
      tags: [TAG.taxonomy],
      revalidate: REVALIDATE.taxonomy,
    });
    return rows.map(mapCategory);
  }

  private async fetchTags(): Promise<DomainTag[]> {
    const rows = await this.transport.read(z.array(kalelTagSchema), {
      path: this.transport.sitePath('/tags'),
      tags: [TAG.taxonomy],
      revalidate: REVALIDATE.taxonomy,
    });
    return rows.map(mapTag);
  }

  private async fetchAuthors(): Promise<Author[]> {
    const rows = await this.transport.read(z.array(kalelAuthorSchema), {
      path: this.transport.sitePath('/authors'),
      tags: [TAG.taxonomy],
      revalidate: REVALIDATE.taxonomy,
    });
    return rows.map((r) => mapAuthor(r));
  }

  private async fetchEntities(): Promise<Map<string, KalElEntity>> {
    try {
      const rows = await this.transport.read(z.array(kalelEntitySchema), {
        path: this.transport.sitePath('/entities'),
        tags: [TAG.taxonomy],
        revalidate: REVALIDATE.taxonomy,
      });
      return new Map(rows.map((r) => [r.id, r]));
    } catch {
      // Entities carry optional commercial metadata only. Losing them must not take a
      // page down; the commercial module falls back to its generic label.
      return new Map();
    }
  }

  /**
   * Media index, paged by offset.
   *
   * Kal El has no batch-by-id media endpoint, so the site library is walked once per
   * revalidate window and indexed. It reports a `total`, which is what bounds the walk —
   * treating this endpoint as cursor-paginated (as the article list is) would stop after
   * the first page and silently drop every older asset.
   */
  private async fetchMediaIndex(): Promise<Map<string, Image>> {
    const index = new Map<string, Image>();
    let offset = 0;
    for (let page = 0; page < MAX_MEDIA_PAGES; page += 1) {
      const res = await this.transport.read(kalelMediaListSchema, {
        path: this.transport.sitePath('/media'),
        query: { limit: MEDIA_PAGE_SIZE, offset },
        tags: [TAG.media],
        revalidate: REVALIDATE.taxonomy,
      });
      for (const row of res.items) index.set(row.id, mapMedia(row, this.mediaUrl));
      offset += res.items.length;
      if (res.items.length === 0 || offset >= res.total) break;
    }
    return index;
  }

  private async context(): Promise<MapperContext> {
    const [categories, tags, authors, media, entities] = await Promise.all([
      this.fetchCategories(),
      this.fetchTags(),
      this.fetchAuthors(),
      this.fetchMediaIndex(),
      this.fetchEntities(),
    ]);
    return {
      categories: new Map(categories.map((c) => [c.id, c])),
      tags: new Map(tags.map((t) => [t.id, t])),
      authors: new Map(authors.map((a) => [a.id, a])),
      media,
      entities,
      mediaUrl: this.mediaUrl,
    };
  }

  // ------------------------------------------------------------------ index

  /**
   * Every published article, reduced and cached.
   *
   * Two callers need the whole corpus and cannot be served by a page of it: the sitemap,
   * which must enumerate all of it, and slug resolution on a Kal El instance without the
   * `slug` filter. One tagged walk per revalidate window serves both.
   *
   * The walk is bounded. Beyond the ceiling it truncates and keeps going rather than
   * throwing: a sitemap covering the most recent 50k articles is useful, a 500 is not.
   */
  private async articleIndex(): Promise<IndexEntry[]> {
    const entries: IndexEntry[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_INDEX_PAGES; page += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', limit: INDEX_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        tags: [TAG.sitemap],
        revalidate: REVALIDATE.sitemap,
      });
      for (const item of res.items) {
        if (!item.slug) continue;
        entries.push({
          id: item.id,
          slug: item.slug,
          categoryId: item.categories[0] ?? null,
          updatedAt: item.updatedAt,
          publishedAt: item.publishedAt,
          title: item.title,
        });
      }
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    return entries;
  }

  // ---------------------------------------------------------------- articles

  private async cursorWindow(
    query: Record<string, string | number | undefined>,
    page: number,
    perPage: number,
    tags: string[],
    revalidate: number,
  ): Promise<CursorWindow> {
    let cursor: string | undefined;
    let items: KalElArticleSummary[] = [];
    let hasNext = false;
    for (let i = 0; i < Math.max(1, page); i += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', limit: perPage, ...query, ...(cursor ? { cursor } : {}) },
        tags,
        revalidate,
      });
      items = res.items;
      hasNext = Boolean(res.nextCursor);
      if (!res.nextCursor) {
        // A page past the end of the archive.
        if (i < page - 1) return { items: [], hasNext: false };
        break;
      }
      cursor = res.nextCursor;
    }
    return { items, hasNext };
  }

  private toPage(items: ArticleSummary[], page: number, perPage: number, hasNext: boolean): Page<ArticleSummary> {
    return { items, page, perPage, total: null, totalPages: null, hasNext };
  }

  /**
   * Maps summaries and drops the ones that have no public URL.
   *
   * Kal El allows a published article with no category; this site has no route for one,
   * so rendering a card for it would link to `/{slug}`, which the catch-all reads as a
   * desk. Dropping it here keeps every card, sitemap entry and feed item linkable.
   */
  private async summaries(rows: KalElArticleSummary[], ctx?: MapperContext): Promise<ArticleSummary[]> {
    const context = ctx ?? (await this.context());
    return rows
      .map((r) => mapArticleSummary(r, context))
      .filter((a): a is ArticleSummary => a !== null && a.category !== null);
  }

  async getHome(): Promise<HomePage> {
    const ctx = await this.context();
    const res = await this.transport.read(kalelArticleListSchema, {
      path: this.transport.sitePath('/articles'),
      query: { status: 'published', limit: 60 },
      tags: [TAG.home],
      revalidate: REVALIDATE.home,
    });
    const all = await this.summaries(res.items, ctx);

    const lead = all[0] ?? null;
    const secondary = all.slice(1, 4);
    const aside = all.slice(4, 6);
    const rest = all.slice(6);

    const byCategory = new Map<string, ArticleSummary[]>();
    for (const a of rest) {
      const key = a.category?.slug ?? 'geral';
      const list = byCategory.get(key);
      if (list) list.push(a);
      else byCategory.set(key, [a]);
    }

    const sections = [...byCategory.entries()]
      .filter(([, list]) => list.length >= 2)
      .slice(0, 4)
      .map(([slug, list]) => ({
        key: slug,
        label: list[0]?.category?.name ?? 'Últimas',
        href: `/${slug}`,
        articles: list.slice(0, 9),
      }));

    // The Cinerie desk owns this data. A failure there degrades the module to nothing
    // and leaves the rest of the home at 200 (docs/10).
    const whereToWatch = await getCinerieTitles();

    /*
     * The banner and the franchise feature, from what the CMS can actually express.
     *
     * There is no dossier model in Kal El — that gap is recorded in KAL-EL-DISCOVERY —
     * so neither module is derived from one. The banner promotes the most recent article
     * carrying a reserved `especial` tag and a cover; the feature promotes the most
     * recent article in a desk under `especiais`. Both render nothing when there is
     * nothing to promote, which is the honest outcome and not an empty frame.
     *
     * The designed three-word lockup has no source here, so `lockup` stays null and the
     * band sets the headline on one line.
     */
    const promoted = all.find((a) => a.cover !== null && a.tags.some((t) => BANNER_TAGS.has(t.slug)));
    const banner = promoted
      ? {
          href: articlePath(promoted) ?? '/especiais',
          label: 'Especial',
          title: promoted.title,
          image: promoted.cover,
          lockup: null,
          tags: promoted.tags.slice(0, 3).map((t) => t.name),
        }
      : null;

    const specialLead = all.find((a) => a.category !== null && SPECIAL_DESKS.has(a.category.slug));
    const special =
      specialLead && specialLead.category
        ? { slug: specialLead.category.slug, name: specialLead.category.name, lead: specialLead }
        : null;

    return {
      lead,
      secondary,
      aside,
      sections,
      mostRead: all.slice(0, 5),
      banner,
      special,
      more: rest.slice(0, 9),
      whereToWatch,
      poll: null,
      updatedAt: lead?.updatedAt ?? this.now().toISOString(),
    };
  }

  /**
   * Resolves a slug to a Kal El article id.
   *
   * The filtered call is verified rather than trusted: an unpatched Kal El ignores an
   * unknown query parameter, which would otherwise serve the most recently updated
   * article under every slug on the site.
   *
   * In preview the status filter is deliberately absent — the whole point of a preview
   * token is to reach an article that is *not* published, and filtering to `published`
   * would answer 404 for every draft.
   */
  private async resolveIdBySlug(slug: string, options?: ReadOptions): Promise<string | null> {
    const preview = options?.preview === true;
    const cacheOpts = preview
      ? { noStore: true as const }
      : { tags: [articleSlugTag(slug)], revalidate: REVALIDATE.article };

    const filtered = await this.transport.read(kalelArticleListSchema, {
      path: this.transport.sitePath('/articles'),
      query: { ...(preview ? {} : { status: 'published' }), slug, limit: 5 },
      ...cacheOpts,
    });
    const direct = filtered.items.find((i) => i.slug === slug);
    if (direct) return direct.id;
    // The filter was honoured and matched nothing: the article does not exist.
    if (filtered.items.length === 0) return null;

    // The filter was ignored. Fall back to the complete index, which is cached, so this
    // costs one corpus walk per revalidate window rather than one per request.
    if (preview) {
      // Drafts are not in the published index, so there is nothing to fall back to. This
      // only happens on an unpatched Kal El, and is reported rather than guessed at.
      throw new ContentError(
        'unsupported',
        'Preview by slug needs the Kal El article slug filter; this instance does not support it',
      );
    }
    const index = await this.articleIndex();
    return index.find((entry) => entry.slug === slug)?.id ?? null;
  }

  async getArticleById(id: string, options?: ReadOptions): Promise<Article | null> {
    const ctx = await this.context();
    try {
      const dto = await this.transport.read(kalelArticleSchema, {
        path: this.transport.sitePath(`/articles/${id}`),
        ...(options?.preview ? { noStore: true as const } : { tags: [articleTag(id)], revalidate: REVALIDATE.article }),
      });
      if (!options?.preview && dto.status !== 'published') return null;
      const mapped = mapArticle(dto, ctx);
      return mapped?.article ?? null;
    } catch (err) {
      if (err instanceof ContentError && err.kind === 'not_found') return null;
      throw err;
    }
  }

  async getArticleBySlug(slug: string, options?: ReadOptions): Promise<Article | null> {
    if (!isValidSlug(slug)) return null;
    const id = await this.resolveIdBySlug(slug, options);
    if (!id) return null;
    return this.getArticleById(id, options);
  }

  async getArticle(categorySlug: string, slug: string, options?: ReadOptions): Promise<Article | null> {
    const article = await this.getArticleBySlug(slug, options);
    if (!article) return null;
    // The canonical URL is `/{categoria}/{slug}`. An article with no desk has no public
    // URL at all, and serving one under an arbitrary desk would create a duplicate the
    // sitemap never declared.
    if (!article.category || article.category.slug !== categorySlug) return null;
    return article;
  }

  // ------------------------------------------------------------- collections

  async listCategories(): Promise<Category[]> {
    return this.fetchCategories();
  }

  async listCategory(slug: string, page: number): Promise<Page<ArticleSummary> & { category: Category }> {
    const ctx = await this.context();
    const category = [...ctx.categories.values()].find((c) => c.slug === slug);
    if (!category) throw ContentError.notFound(`category ${slug}`);
    const win = await this.cursorWindow(
      { categoryId: category.id },
      page,
      DEFAULT_PER_PAGE,
      [categoryTag(slug)],
      REVALIDATE.category,
    );
    const items = await this.summaries(win.items, ctx);
    return { ...this.toPage(items, page, DEFAULT_PER_PAGE, win.hasNext), category };
  }

  async search(query: string, page: number): Promise<Page<SearchResult>> {
    const trimmed = query.trim().slice(0, 120);
    if (trimmed.length < 2) return emptyPage<SearchResult>(page, SEARCH_PER_PAGE);
    const ctx = await this.context();
    // Search is always dynamic: `no-store`, never a shared cache entry.
    let cursor: string | undefined;
    let rows: KalElArticleSummary[] = [];
    let hasNext = false;
    for (let i = 0; i < Math.max(1, page); i += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', q: trimmed, limit: SEARCH_PER_PAGE, ...(cursor ? { cursor } : {}) },
        noStore: true,
      });
      rows = res.items;
      hasNext = Boolean(res.nextCursor);
      if (!res.nextCursor) {
        if (i < page - 1) return emptyPage<SearchResult>(page, SEARCH_PER_PAGE);
        break;
      }
      cursor = res.nextCursor;
    }
    const items = (await this.summaries(rows, ctx)) as SearchResult[];
    return { items, page, perPage: SEARCH_PER_PAGE, total: null, totalPages: null, hasNext };
  }

  async getAuthor(slug: string, page: number): Promise<(Page<ArticleSummary> & { author: Author }) | null> {
    const ctx = await this.context();
    const author = [...ctx.authors.values()].find((a) => a.slug === slug);
    if (!author) return null;
    const win = await this.cursorWindow(
      { authorId: author.id },
      page,
      DEFAULT_PER_PAGE,
      [authorTag(slug)],
      REVALIDATE.author,
    );
    const items = await this.summaries(win.items, ctx);
    return { ...this.toPage(items, page, DEFAULT_PER_PAGE, win.hasNext), author };
  }

  async getTag(slug: string, page: number): Promise<(Page<ArticleSummary> & { tag: DomainTag }) | null> {
    const ctx = await this.context();
    const tag = [...ctx.tags.values()].find((t) => t.slug === slug);
    if (!tag) return null;
    const win = await this.cursorWindow({ tagId: tag.id }, page, DEFAULT_PER_PAGE, [tagTag(slug)], REVALIDATE.tag);
    const items = await this.summaries(win.items, ctx);
    return { ...this.toPage(items, page, DEFAULT_PER_PAGE, win.hasNext), tag };
  }

  async listByTemplate(template: 'video' | 'list', page: number): Promise<Page<ArticleSummary>> {
    const win = await this.cursorWindow({ type: template }, page, DEFAULT_PER_PAGE, [TAG.home], REVALIDATE.category);
    return this.toPage(await this.summaries(win.items), page, DEFAULT_PER_PAGE, win.hasNext);
  }

  async listReviews(page: number): Promise<Page<ArticleSummary>> {
    const win = await this.cursorWindow({ type: 'review' }, page, DEFAULT_PER_PAGE, [TAG.home], REVALIDATE.category);
    return this.toPage(await this.summaries(win.items), page, DEFAULT_PER_PAGE, win.hasNext);
  }

  async listOffers(page: number): Promise<Page<ArticleSummary>> {
    const ctx = await this.context();
    const campaign = [...ctx.tags.values()].find((t) => t.slug === 'campanha' || t.slug === 'ofertas');
    if (!campaign) return emptyPage<ArticleSummary>(page);
    const win = await this.cursorWindow(
      { tagId: campaign.id },
      page,
      DEFAULT_PER_PAGE,
      [tagTag(campaign.slug)],
      REVALIDATE.category,
    );
    return this.toPage(await this.summaries(win.items, ctx), page, DEFAULT_PER_PAGE, win.hasNext);
  }

  // ----------------------------------------------------------- specials/live

  /**
   * Specials and live coverage.
   *
   * Kal El has no franchise/dossier/live-event model. A special is a category under the
   * reserved `especiais` parent and its dossiers are that category's children; a live
   * event is an article tagged `ao-vivo` whose headings are read as the update timeline.
   * This is the honest maximum with the current contract; the CMS change that would make
   * it first-class is proposed in KAL-EL-DISCOVERY.md.
   */
  async getSpecial(slugs: string[]): Promise<Special | null> {
    const franchiseSlug = slugs[0];
    if (!franchiseSlug) return null;
    const ctx = await this.context();
    const category = [...ctx.categories.values()].find((c) => c.slug === franchiseSlug);
    if (!category) return null;

    const win = await this.cursorWindow(
      { categoryId: category.id },
      1,
      24,
      [specialTag(franchiseSlug)],
      REVALIDATE.special,
    );
    const articles = await this.summaries(win.items, ctx);
    const children = [...ctx.categories.values()].filter((c) => c.parentId === category.id);

    return {
      franchise: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        cover: articles[0]?.cover ?? null,
      },
      dossiers: children.map((c) => ({
        id: c.id,
        slug: c.slug,
        franchiseId: category.id,
        title: c.name,
        kicker: category.name,
        cover: null,
        chapters: [],
      })),
      articles,
      liveEvent: null,
    };
  }

  async listSpecials(): Promise<Special[]> {
    const ctx = await this.context();
    const root = [...ctx.categories.values()].find((c) => c.slug === 'especiais');
    if (!root) return [];
    const children = [...ctx.categories.values()].filter((c) => c.parentId === root.id);
    const specials = await Promise.all(children.map((c) => this.getSpecial([c.slug])));
    return specials.filter((s): s is Special => s !== null);
  }

  async getLiveEvent(slug: string): Promise<LiveEvent | null> {
    const article = await this.getArticleBySlug(slug);
    if (!article || article.template !== 'urgent') return null;
    const entries = article.body
      .filter((b): b is Extract<typeof b, { type: 'heading' }> => b.type === 'heading')
      .map((h, index) => ({
        id: h.id,
        time: article.updatedAt,
        title: h.text,
        text: h.text,
        important: index === 0,
      }));
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      status: 'live',
      entries,
      startedAt: article.publishedAt ?? article.updatedAt,
    };
  }

  // --------------------------------------------------------------- discovery

  /** How many article sitemap files exist, so the index can name every one of them. */
  async countSitemapPages(): Promise<number> {
    const index = await this.articleIndex();
    return Math.max(1, Math.ceil(index.length / SITEMAP_PAGE_SIZE));
  }

  /**
   * One sitemap file.
   *
   * `cursor` is the 1-based page number for articles. A cursor was the wrong shape here:
   * a sitemap index has to name every child file up front, and an opaque cursor cannot
   * be enumerated — so only the first 100 URLs were ever discoverable.
   */
  async listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage> {
    const ctx = await this.context();

    if (kind === 'categories') {
      return {
        entries: [...ctx.categories.values()].map((c) => ({
          path: `/${c.slug}`,
          lastModified: this.now().toISOString(),
        })),
        nextCursor: null,
      };
    }
    if (kind === 'tags') {
      return {
        entries: [...ctx.tags.values()].map((t) => ({
          path: `/tag/${t.slug}`,
          lastModified: this.now().toISOString(),
        })),
        nextCursor: null,
      };
    }
    if (kind === 'authors') {
      return {
        entries: [...ctx.authors.values()].map((a) => ({
          path: `/autor/${a.slug}`,
          lastModified: this.now().toISOString(),
        })),
        nextCursor: null,
      };
    }

    const index = await this.articleIndex();
    const page = Math.max(1, Number(cursor ?? 1) || 1);
    const start = (page - 1) * SITEMAP_PAGE_SIZE;
    const slice = index.slice(start, start + SITEMAP_PAGE_SIZE);

    const entries: SitemapEntry[] = slice
      .map((entry): SitemapEntry | null => {
        const category = entry.categoryId ? ctx.categories.get(entry.categoryId) : undefined;
        // An article whose desk was deleted has no public URL; it must not enter a sitemap.
        if (!category) return null;
        return {
          path: `/${category.slug}/${entry.slug}`,
          lastModified: entry.updatedAt,
          title: entry.title,
          ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
        };
      })
      .filter((e): e is SitemapEntry => e !== null);

    const hasNext = start + SITEMAP_PAGE_SIZE < index.length;
    return { entries, nextCursor: hasNext ? String(page + 1) : null };
  }

  /**
   * Recent articles, for the RSS feed and the Google News sitemap.
   *
   * Paginated: Kal El caps `limit` at 100, so a single call could only ever return the
   * hundred most recently updated articles. The news sitemap asks for up to a thousand
   * from the last 48 hours, and on a busy day that silently lost everything past the
   * first page.
   *
   * The walk stops as soon as a page is entirely older than the cutoff. The list is
   * ordered by `updatedAt`, not `publishedAt`, so it stops one page late rather than
   * early — a re-edited old article can appear among recent ones.
   */
  async listRecentNews(since: Date, limit: number): Promise<ArticleSummary[]> {
    const ctx = await this.context();
    const collected: ArticleSummary[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_NEWS_PAGES && collected.length < limit; page += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', limit: INDEX_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        tags: [TAG.news],
        revalidate: REVALIDATE.news,
      });

      const items = await this.summaries(res.items, ctx);
      collected.push(...items.filter((a) => a.publishedAt !== null && new Date(a.publishedAt) >= since));

      const everythingOlder =
        items.length > 0 && items.every((a) => a.publishedAt === null || new Date(a.publishedAt) < since);
      if (everythingOlder || !res.nextCursor) break;
      cursor = res.nextCursor;
    }

    return collected.slice(0, limit);
  }

  async listRedirects(): Promise<LegacyRedirect[]> {
    try {
      const rows = await this.transport.read(z.array(kalelRedirectSchema), {
        path: this.transport.sitePath('/redirects'),
        tags: [TAG.redirects],
        revalidate: REVALIDATE.redirects,
      });
      return rows.map((r) => ({
        from: r.sourcePath,
        to: r.targetPath,
        status: r.kind === '302' ? (302 as const) : (301 as const),
      }));
    } catch (err) {
      if (err instanceof ContentError && err.kind === 'not_found') return [];
      throw err;
    }
  }

  // ------------------------------------------------------------------- media

  /** Media metadata for the proxy route, so it can pin the response content type. */
  async getMedia(mediaId: string): Promise<{ mimeType: string; filename: string } | null> {
    try {
      const row = await this.transport.read(kalelMediaSchema, {
        path: this.transport.sitePath(`/media/${mediaId}`),
        tags: [TAG.media],
        revalidate: REVALIDATE.taxonomy,
      });
      return { mimeType: row.mimeType, filename: row.filename };
    } catch (err) {
      if (err instanceof ContentError && err.kind === 'not_found') return null;
      throw err;
    }
  }

  /** Raw media bytes, streamed by `/media/[id]`. */
  async mediaBytes(mediaId: string, signal?: AbortSignal): Promise<Response> {
    return this.transport.readBytes(this.transport.sitePath(`/media/${mediaId}/file`), signal);
  }

  // ------------------------------------------------------- revalidation help

  /**
   * The taxonomy an article belongs to, for targeted cache invalidation.
   *
   * The webhook payload carries only an article id and slug, so the desk, tag and author
   * archives it appears in have to be looked up before their tags can be purged —
   * otherwise those listings stay stale until their own ISR window elapses.
   */
  async relationsFor(articleId: string): Promise<ArticleRelations> {
    const ctx = await this.context();
    const dto = await this.transport.read(kalelArticleSchema, {
      path: this.transport.sitePath(`/articles/${articleId}`),
      noStore: true,
    });
    return {
      categories: dto.categories.map((id) => ctx.categories.get(id)?.slug).filter((s): s is string => Boolean(s)),
      tags: dto.tags.map((id) => ctx.tags.get(id)?.slug).filter((s): s is string => Boolean(s)),
      authors: dto.authors.map((id) => ctx.authors.get(id)?.slug).filter((s): s is string => Boolean(s)),
    };
  }
}
