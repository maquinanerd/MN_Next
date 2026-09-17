import 'server-only';

import { z } from 'zod';

import { TAG, REVALIDATE, articleSlugTag, articleTag, authorTag, categoryTag, tagTag } from '../cache-tags';
import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  Image,
  LegacyRedirect,
  Page,
  ReadOptions,
  SearchResult,
  SitemapEntry,
  SitemapKind,
  SitemapPage,
  Tag as DomainTag,
} from '../domain/types';
import { ContentError } from '../errors';
import { logger } from '../logger';
import { LAYOUT_TAGS, articlePath, isReservedTag, resolveLayout } from '../paths';
import {
  SEARCH_PER_PAGE,
  byPublishedDesc,
  emptyPage,
  windowOffsets,
  type ArticleRelations,
  type ContentRepository,
  type ListWindow,
} from '../repository';
import { isValidSlug } from '../slug';
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
  type KalElArticle,
  type KalElArticleSummary,
  type KalElAuthor,
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
 * Five properties of the real Kal El API shape this file:
 *
 *  1. **There is no public delivery endpoint.** Every read carries the server-only
 *     service token; `server-only` makes a client import a build error.
 *  2. **Lookup by slug** uses the `slug` filter added by the companion Kal El change, and
 *     the result is re-checked — an instance without the change ignores the parameter.
 *  3. **Publication order.** Kal El lists by `updatedAt` unless asked for
 *     `order=published` (companion change). An imported archive is written in a single
 *     afternoon, so update order would put a migration batch on the front page. Every
 *     list asks for publication order, and every page is also sorted locally, so an
 *     instance without the change is still ordered correctly within the page it returns.
 *  4. **Two pagination models.** Articles page by cursor, or — on an instance with the
 *     companion change — by `offset` with a `total`; media page by `limit`/`offset`.
 *     Conflating them truncates an index silently.
 *  5. **The archive's long tail is read by id.** An imported archive has tens of thousands
 *     of tags and of media rows, and a page shows a handful of each. Categories, authors
 *     and entities are few and are read whole; tags and media are read by the ids the
 *     page's articles point at (`?ids=`, kal-el H3). An instance without that filter still
 *     works, through the slow path it had before.
 */

/** Articles page by cursor at 100 per call; 500 pages is a 50k-article ceiling. */
const INDEX_PAGE_SIZE = 100;
const MAX_INDEX_PAGES = 500;

/**
 * How deep a listing may walk the cursor for one page when the instance cannot jump by
 * offset: 20 calls, 2 000 stories — page 222 of the feed. A page number comes from a URL,
 * so without a bound any visitor could make one render crawl the whole archive.
 */
const MAX_WALK_PAGES = 20;

/** How far back the news walk will page before giving up. 1000 articles is the cap. */
const MAX_NEWS_PAGES = 10;

/** Media pages by offset; Kal El caps `limit` at 200. Only the fallback walks it. */
const MEDIA_PAGE_SIZE = 200;
const MAX_MEDIA_PAGES = 200;

/** Kal El answers at most 200 ids per call, for tags and for media. */
const IDS_PER_CALL = 200;

/** The tag sitemap pages the whole vocabulary at this size: 100 calls, 100k tags. */
const TAG_PAGE_SIZE = 1000;
const MAX_TAG_PAGES = 100;

/** Concurrent reads when one page of work needs many (a sitemap file is 50 list calls). */
const PARALLEL_READS = 5;

/** Every article listing asks for publication order (see property 3 above). */
const PUBLISHED_ORDER = { order: 'published' } as const;

/** One published article, reduced to what slug resolution and the sitemaps need. */
interface IndexEntry {
  id: string;
  slug: string;
  categoryId: string | null;
  tagIds: string[];
  updatedAt: string;
  publishedAt: string | null;
  title: string;
}

interface ListResult {
  items: KalElArticleSummary[];
  total: number | null;
  hasNext: boolean;
}

/** The records a page renders, by id — what the mapper context must hold for it. */
interface Needs {
  tagIds: Set<string>;
  mediaIds: Set<string>;
  authorIds: Set<string>;
}

function needsOf(rows: readonly KalElArticleSummary[]): Needs {
  const needs: Needs = { tagIds: new Set(), mediaIds: new Set(), authorIds: new Set() };
  for (const row of rows) {
    for (const id of row.tags) needs.tagIds.add(id);
    for (const id of row.authors) needs.authorIds.add(id);
    if (row.featuredMediaId) needs.mediaIds.add(row.featuredMediaId);
  }
  return needs;
}

/** An article's needs: its summary's, plus every image its body and its share card show. */
function needsOfArticle(dto: KalElArticle): Needs {
  const needs = needsOf([dto]);
  for (const node of dto.document.nodes) {
    if (node.type === 'image') needs.mediaIds.add(node.attrs.mediaId);
    if (node.type === 'gallery') for (const id of node.attrs.mediaIds) needs.mediaIds.add(id);
  }
  if (dto.seo?.socialImageMediaId) needs.mediaIds.add(dto.seo.socialImageMediaId);
  return needs;
}

/**
 * Sorted, then cut into calls. Sorting is what lets two pages that show the same stories
 * share one cached response: the fetch cache keys on the URL, and a set has no order.
 */
function idChunks(ids: Iterable<string>): string[][] {
  const sorted = [...new Set(ids)].sort();
  const out: string[][] = [];
  for (let i = 0; i < sorted.length; i += IDS_PER_CALL) out.push(sorted.slice(i, i + IDS_PER_CALL));
  return out;
}

/** Runs `work` over `items` with at most `limit` in flight, keeping the input order. */
async function inBatches<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(work))));
  }
  return out;
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

  /**
   * Tags by id, two hundred per call. An instance without the `ids` filter answers every
   * call with the whole vocabulary: a superset, so the lookup below is still right — only
   * slower, which is the state of affairs before the filter existed.
   */
  private async fetchTagsByIds(ids: Iterable<string>): Promise<Map<string, DomainTag>> {
    const pages = await Promise.all(
      idChunks(ids).map((chunk) =>
        this.transport.read(z.array(kalelTagSchema), {
          path: this.transport.sitePath('/tags'),
          query: { ids: chunk.join(',') },
          tags: [TAG.taxonomy],
          revalidate: REVALIDATE.taxonomy,
        }),
      ),
    );
    return new Map(pages.flat().map((row) => [row.id, mapTag(row)]));
  }

  /** One tag by its exact slug, re-checked: an instance without the filter returns them all. */
  private async fetchTagBySlug(slug: string): Promise<DomainTag | null> {
    if (!isValidSlug(slug)) return null;
    const rows = await this.transport.read(z.array(kalelTagSchema), {
      path: this.transport.sitePath('/tags'),
      query: { slug },
      tags: [TAG.taxonomy],
      revalidate: REVALIDATE.taxonomy,
    });
    const row = rows.find((r) => r.slug === slug);
    return row ? mapTag(row) : null;
  }

  private async fetchAuthorRows(): Promise<KalElAuthor[]> {
    return this.transport.read(z.array(kalelAuthorSchema), {
      path: this.transport.sitePath('/authors'),
      tags: [TAG.taxonomy],
      revalidate: REVALIDATE.taxonomy,
    });
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
      // Entities carry optional commercial metadata only; losing them must not take a
      // page down. The commercial label falls back to its generic text.
      return new Map();
    }
  }

  /**
   * Media by id.
   *
   * With the `ids` filter the answer holds only rows that were asked for. An instance
   * without it answers with the first page of the whole library instead — recognisable,
   * because it holds rows nobody asked for — and only then is the library walked, the way
   * every page read it before the filter existed.
   */
  private async fetchMediaByIds(ids: Iterable<string>): Promise<Map<string, Image>> {
    const chunks = idChunks(ids);
    const images = new Map<string, Image>();
    if (chunks.length === 0) return images;

    const pages = await Promise.all(
      chunks.map((chunk) =>
        this.transport.read(kalelMediaListSchema, {
          path: this.transport.sitePath('/media'),
          query: { ids: chunk.join(',') },
          tags: [TAG.media],
          revalidate: REVALIDATE.taxonomy,
        }),
      ),
    );
    const wanted = new Set(chunks.flat());
    const rows = pages.flatMap((page) => page.items);
    if (rows.some((row) => !wanted.has(row.id))) {
      logger.warn('kalel.contract.degraded', { capability: 'media-ids', fallback: 'library walk' });
      const index = await this.fetchMediaIndex();
      for (const id of wanted) {
        const image = index.get(id);
        if (image) images.set(id, image);
      }
      return images;
    }
    for (const row of rows) images.set(row.id, mapMedia(row, this.mediaUrl));
    return images;
  }

  /**
   * The whole media library, paged by offset — the fallback for an instance without the
   * `ids` filter. Its `total` bounds the walk.
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

  /**
   * The mapper context for exactly what a page renders. Portraits are read for the authors
   * the page credits, not for the whole newsroom.
   */
  private async contextFor(needs: Needs): Promise<MapperContext> {
    const [categories, authorRows, entities, tags] = await Promise.all([
      this.fetchCategories(),
      this.fetchAuthorRows(),
      this.fetchEntities(),
      this.fetchTagsByIds(needs.tagIds),
    ]);
    const mediaIds = new Set(needs.mediaIds);
    for (const row of authorRows) {
      if (row.avatarMediaId && needs.authorIds.has(row.id)) mediaIds.add(row.avatarMediaId);
    }
    const media = await this.fetchMediaByIds(mediaIds);
    const authors = authorRows.map((row) => mapAuthor(row, media));
    return {
      categories: new Map(categories.map((c) => [c.id, c])),
      tags,
      authors: new Map(authors.map((a) => [a.id, a])),
      media,
      entities,
      mediaUrl: this.mediaUrl,
    };
  }

  /** The layout-carrying reserved tags, by id — all a URL needs to know about an article's tags. */
  private async layoutTagsById(): Promise<Map<string, DomainTag>> {
    const slugs = [...LAYOUT_TAGS.offer, ...LAYOUT_TAGS.overlay];
    const found = await Promise.all(slugs.map((slug) => this.fetchTagBySlug(slug)));
    return new Map(found.filter((t): t is DomainTag => t !== null).map((t) => [t.id, t]));
  }

  // ------------------------------------------------------------------ index

  /**
   * Every published article, reduced and cached — for slug resolution on an instance
   * without the `slug` filter, and for the sitemaps of an instance without `offset`.
   * Bounded: beyond the ceiling it truncates rather than failing the sitemap.
   */
  private async articleIndex(): Promise<IndexEntry[]> {
    const entries: IndexEntry[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_INDEX_PAGES; page += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', ...PUBLISHED_ORDER, limit: INDEX_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        tags: [TAG.sitemap],
        revalidate: REVALIDATE.sitemap,
      });
      for (const item of res.items) {
        const entry = indexEntry(item);
        if (entry) entries.push(entry);
      }
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
    return entries.sort((a, b) => byPublishedDesc(a, b));
  }

  /**
   * One sitemap file's worth of articles, addressed by offset: fifty calls of a hundred,
   * instead of walking the whole archive for every file. Null on an instance that cannot
   * jump by offset (no `total`), which then uses the index.
   */
  private async sitemapSlice(start: number): Promise<{ entries: IndexEntry[]; total: number } | null> {
    const offsets = Array.from(
      { length: Math.ceil(SITEMAP_PAGE_SIZE / INDEX_PAGE_SIZE) },
      (_, i) => start + i * INDEX_PAGE_SIZE,
    );
    const first = await this.transport.read(kalelArticleListSchema, {
      path: this.transport.sitePath('/articles'),
      query: { status: 'published', ...PUBLISHED_ORDER, limit: INDEX_PAGE_SIZE, offset: start },
      tags: [TAG.sitemap],
      revalidate: REVALIDATE.sitemap,
    });
    if (typeof first.total !== 'number') return null;
    const total = first.total;
    const rest = await inBatches(
      offsets.slice(1).filter((offset) => offset < total),
      PARALLEL_READS,
      (offset) =>
        this.transport.read(kalelArticleListSchema, {
          path: this.transport.sitePath('/articles'),
          query: { status: 'published', ...PUBLISHED_ORDER, limit: INDEX_PAGE_SIZE, offset },
          tags: [TAG.sitemap],
          revalidate: REVALIDATE.sitemap,
        }),
    );
    const entries = [first, ...rest]
      .flatMap((page) => page.items)
      .map(indexEntry)
      .filter((e): e is IndexEntry => e !== null);
    return { entries, total };
  }

  // ---------------------------------------------------------------- listings

  /**
   * One window of a listing, newest publication first.
   *
   * Asks for `offset` and publication order. An instance with the companion change answers
   * with a `total`, and the window is exactly that page, in one request. An instance
   * without it ignores both parameters — and then the only honest answer is to walk the
   * cursor far enough to cover the window, so a deep page costs several requests (each
   * cached) rather than returning the first page's stories under a page-5 URL.
   */
  private async listWindow(
    query: Record<string, string | number | undefined>,
    page: number,
    window: ListWindow | undefined,
    tags: string[],
    revalidate: number,
  ): Promise<ListResult & { perPage: number; skip: number }> {
    const { perPage, skip, offset } = windowOffsets(page, window);
    const base = { status: 'published', ...PUBLISHED_ORDER, ...query };

    const direct = await this.transport.read(kalelArticleListSchema, {
      path: this.transport.sitePath('/articles'),
      query: { ...base, limit: Math.min(perPage, 100), offset },
      tags,
      revalidate,
    });
    if (typeof direct.total === 'number') {
      return {
        items: direct.items,
        total: Math.max(0, direct.total - skip),
        hasNext: offset + direct.items.length < direct.total,
        perPage,
        skip,
      };
    }

    // No `total`: the instance ignored `offset`. Walk the cursor to cover the window —
    // bounded, so a deep page number in a URL cannot turn one render into a crawl of the
    // archive. Past the bound the window is empty, and the routes answer 404 for it.
    const needed = offset + perPage + 1;
    if (needed > MAX_WALK_PAGES * INDEX_PAGE_SIZE) return { items: [], total: null, hasNext: false, perPage, skip };
    const collected: KalElArticleSummary[] = [];
    let cursor: string | undefined;
    let exhausted = false;
    for (let walked = 0; walked < MAX_WALK_PAGES && collected.length < needed; walked += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { ...base, limit: INDEX_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        tags,
        revalidate,
      });
      collected.push(...res.items);
      if (!res.nextCursor) {
        exhausted = true;
        break;
      }
      cursor = res.nextCursor;
    }
    return {
      items: collected.slice(offset, offset + perPage),
      total: exhausted ? Math.max(0, collected.length - skip) : null,
      hasNext: collected.length > offset + perPage,
      perPage,
      skip,
    };
  }

  /**
   * Maps summaries, drops the ones with no public URL, and sorts by publication — the
   * local sort is what keeps an instance without the ordering change correct per page.
   */
  private async summaries(rows: KalElArticleSummary[], ctx?: MapperContext): Promise<ArticleSummary[]> {
    const context = ctx ?? (await this.contextFor(needsOf(rows)));
    return rows
      .map((r) => mapArticleSummary(r, context))
      .filter((a): a is ArticleSummary => a !== null && articlePath(a) !== null)
      .sort(byPublishedDesc);
  }

  private toPage(items: ArticleSummary[], page: number, win: ListResult & { perPage: number }): Page<ArticleSummary> {
    return {
      items,
      page,
      perPage: win.perPage,
      total: win.total,
      totalPages: win.total === null ? null : Math.max(1, Math.ceil(win.total / win.perPage)),
      hasNext: win.hasNext,
    };
  }

  async listLatest(page: number, window?: ListWindow): Promise<Page<ArticleSummary>> {
    const win = await this.listWindow({}, page, window, [TAG.home], REVALIDATE.home);
    return this.toPage(await this.summaries(win.items), page, win);
  }

  async listCategory(
    slug: string,
    page: number,
    window?: ListWindow,
  ): Promise<Page<ArticleSummary> & { category: Category }> {
    const category = (await this.fetchCategories()).find((c) => c.slug === slug);
    if (!category) throw ContentError.notFound(`category ${slug}`);
    const win = await this.listWindow(
      { categoryId: category.id },
      page,
      window,
      [categoryTag(slug)],
      REVALIDATE.category,
    );
    return { ...this.toPage(await this.summaries(win.items), page, win), category };
  }

  async listCategories(): Promise<Category[]> {
    return this.fetchCategories();
  }

  async findTags(slugs: readonly string[]): Promise<DomainTag[]> {
    const found = await Promise.all([...new Set(slugs)].map((slug) => this.fetchTagBySlug(slug)));
    return found.filter((t): t is DomainTag => t !== null);
  }

  /** The first `n` published stories of a listing, a hundred at a time, bounded. */
  private async head(
    query: Record<string, string>,
    n: number,
    tags: string[],
    revalidate: number,
  ): Promise<{ items: KalElArticleSummary[]; complete: boolean }> {
    const items: KalElArticleSummary[] = [];
    let cursor: string | undefined;
    for (let walked = 0; walked < MAX_WALK_PAGES && items.length < n; walked += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: {
          status: 'published',
          ...PUBLISHED_ORDER,
          ...query,
          limit: INDEX_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        },
        tags,
        revalidate,
      });
      items.push(...res.items);
      if (!res.nextCursor) return { items, complete: true };
      cursor = res.nextCursor;
    }
    return { items, complete: false };
  }

  /**
   * Offer pages: articles carrying the reserved `oferta` tag or one of its synonyms — every
   * one of them lays the article out as an offer, so every one must list it here too.
   */
  async listOffers(page: number, window?: ListWindow): Promise<Page<ArticleSummary>> {
    const offerTags = await this.findTags(LAYOUT_TAGS.offer);
    const [only] = offerTags;
    if (!only) return emptyPage<ArticleSummary>(page, windowOffsets(page, window).perPage);
    if (offerTags.length === 1) {
      const win = await this.listWindow({ tagId: only.id }, page, window, [tagTag(only.slug)], REVALIDATE.category);
      return this.toPage(await this.summaries(win.items), page, win);
    }

    // Several synonyms in use (an archive imported with `afiliado`, a newsroom tagging
    // `oferta`): each is its own listing in the CMS, so the head of each, deep enough to
    // cover the window, is merged and cut here.
    const { perPage, skip, offset } = windowOffsets(page, window);
    const needed = offset + perPage + 1;
    if (needed > MAX_WALK_PAGES * INDEX_PAGE_SIZE) return emptyPage<ArticleSummary>(page, perPage);
    const heads = await Promise.all(
      offerTags.map((t) => this.head({ tagId: t.id }, needed, [tagTag(t.slug)], REVALIDATE.category)),
    );
    const seen = new Set<string>();
    const merged: KalElArticleSummary[] = [];
    for (const row of heads.flatMap((h) => h.items)) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    const all = await this.summaries(merged);
    const complete = heads.every((h) => h.complete);
    return this.toPage(all.slice(offset, offset + perPage), page, {
      items: [],
      total: complete ? Math.max(0, all.length - skip) : null,
      hasNext: all.length > offset + perPage,
      perPage,
    });
  }

  async search(query: string, page: number): Promise<Page<SearchResult>> {
    const trimmed = query.trim().slice(0, 120);
    if (trimmed.length < 2) return emptyPage<SearchResult>(page, SEARCH_PER_PAGE);
    // Search is always dynamic: `no-store`, never a shared cache entry.
    let cursor: string | undefined;
    let rows: KalElArticleSummary[] = [];
    let hasNext = false;
    for (let i = 0; i < Math.max(1, page); i += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: {
          status: 'published',
          ...PUBLISHED_ORDER,
          q: trimmed,
          limit: SEARCH_PER_PAGE,
          ...(cursor ? { cursor } : {}),
        },
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
    const items = (await this.summaries(rows)) as SearchResult[];
    return { items, page, perPage: SEARCH_PER_PAGE, total: null, totalPages: null, hasNext };
  }

  async getAuthor(slug: string, page: number): Promise<(Page<ArticleSummary> & { author: Author }) | null> {
    const row = (await this.fetchAuthorRows()).find((a) => a.slug === slug);
    if (!row) return null;
    const win = await this.listWindow({ authorId: row.id }, page, undefined, [authorTag(slug)], REVALIDATE.author);
    const needs = needsOf(win.items);
    needs.authorIds.add(row.id);
    const ctx = await this.contextFor(needs);
    const author = ctx.authors.get(row.id) ?? mapAuthor(row);
    return { ...this.toPage(await this.summaries(win.items, ctx), page, win), author };
  }

  async getTag(slug: string, page: number): Promise<(Page<ArticleSummary> & { tag: DomainTag }) | null> {
    const tag = await this.fetchTagBySlug(slug);
    if (!tag) return null;
    const win = await this.listWindow({ tagId: tag.id }, page, undefined, [tagTag(slug)], REVALIDATE.tag);
    return { ...this.toPage(await this.summaries(win.items), page, win), tag };
  }

  // ---------------------------------------------------------------- articles

  /**
   * Resolves a slug to a Kal El article id. The filtered call is verified rather than
   * trusted: an unpatched Kal El ignores an unknown parameter and would otherwise serve
   * the most recently updated article under every slug on the site. In preview the status
   * filter is absent — a preview token exists to reach an unpublished article.
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

    if (preview) {
      // Drafts are not in the published index, so there is nothing to fall back to.
      throw new ContentError(
        'unsupported',
        'Preview by slug needs the Kal El article slug filter; this instance does not support it',
      );
    }
    const index = await this.articleIndex();
    return index.find((entry) => entry.slug === slug)?.id ?? null;
  }

  async getArticleById(id: string, options?: ReadOptions): Promise<Article | null> {
    try {
      const dto = await this.transport.read(kalelArticleSchema, {
        path: this.transport.sitePath(`/articles/${id}`),
        ...(options?.preview ? { noStore: true as const } : { tags: [articleTag(id)], revalidate: REVALIDATE.article }),
      });
      if (!options?.preview && dto.status !== 'published') return null;
      return mapArticle(dto, await this.contextFor(needsOfArticle(dto)))?.article ?? null;
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

  /**
   * The article at `/{editoria}/{slug}`. An article whose desk differs is not served under
   * another desk — that would be a duplicate no sitemap declared. Offer pages are resolved
   * by slug at `/ofertas/{slug}` instead.
   */
  async getArticle(categorySlug: string, slug: string, options?: ReadOptions): Promise<Article | null> {
    const article = await this.getArticleBySlug(slug, options);
    if (!article) return null;
    if (!article.category || article.category.slug !== categorySlug) return null;
    return article;
  }

  // --------------------------------------------------------------- discovery

  async countSitemapPages(): Promise<number> {
    const probe = await this.transport.read(kalelArticleListSchema, {
      path: this.transport.sitePath('/articles'),
      query: { status: 'published', ...PUBLISHED_ORDER, limit: 1, offset: 0 },
      tags: [TAG.sitemap],
      revalidate: REVALIDATE.sitemap,
    });
    const count = typeof probe.total === 'number' ? probe.total : (await this.articleIndex()).length;
    return Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE));
  }

  /** One sitemap file; for articles, `cursor` is the 1-based page number. */
  async listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage> {
    const stamp = this.now().toISOString();

    if (kind === 'categories') {
      return {
        entries: (await this.fetchCategories()).map((c) => ({ path: `/${c.slug}`, lastModified: stamp })),
        nextCursor: null,
      };
    }
    if (kind === 'tags') {
      return {
        // Reserved tags are switches, not archives: `/tag/oferta` is a 404 by design.
        entries: (await this.allTags())
          .filter((t) => !isReservedTag(t.slug))
          .map((t) => ({ path: `/tag/${t.slug}`, lastModified: stamp })),
        nextCursor: null,
      };
    }
    if (kind === 'authors') {
      return {
        entries: (await this.fetchAuthorRows()).map((a) => ({ path: `/autor/${a.slug}`, lastModified: stamp })),
        nextCursor: null,
      };
    }

    const page = Math.max(1, Number(cursor ?? 1) || 1);
    const start = (page - 1) * SITEMAP_PAGE_SIZE;
    const sliced = await this.sitemapSlice(start);
    let slice: IndexEntry[];
    let hasNext: boolean;
    if (sliced) {
      slice = sliced.entries;
      hasNext = start + SITEMAP_PAGE_SIZE < sliced.total;
    } else {
      const index = await this.articleIndex();
      slice = index.slice(start, start + SITEMAP_PAGE_SIZE);
      hasNext = start + SITEMAP_PAGE_SIZE < index.length;
    }

    const [categories, layoutTags] = await Promise.all([this.fetchCategories(), this.layoutTagsById()]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const entries: SitemapEntry[] = slice
      .map((entry): SitemapEntry | null => {
        const category = entry.categoryId ? (categoryById.get(entry.categoryId) ?? null) : null;
        // Only a layout tag can change an article's URL, so only those are resolved.
        const tags = entry.tagIds.map((id) => layoutTags.get(id)).filter((t): t is DomainTag => Boolean(t));
        const path = articlePath({ slug: entry.slug, category, layout: resolveLayout(tags) });
        // An article with no public URL must not enter a sitemap.
        if (!path) return null;
        return {
          path,
          lastModified: entry.updatedAt,
          title: entry.title,
          ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
        };
      })
      .filter((e): e is SitemapEntry => e !== null);

    return { entries, nextCursor: hasNext ? String(page + 1) : null };
  }

  /**
   * The whole vocabulary, for the tag sitemap only, a thousand at a time in name order. An
   * instance without paging answers every call with everything: the first answer is then
   * the whole list, and a page that adds nothing new ends the walk either way.
   */
  private async allTags(): Promise<DomainTag[]> {
    const byId = new Map<string, DomainTag>();
    for (let page = 0; page < MAX_TAG_PAGES; page += 1) {
      const rows = await this.transport.read(z.array(kalelTagSchema), {
        path: this.transport.sitePath('/tags'),
        query: { limit: TAG_PAGE_SIZE, offset: page * TAG_PAGE_SIZE },
        tags: [TAG.taxonomy],
        revalidate: REVALIDATE.taxonomy,
      });
      const before = byId.size;
      for (const row of rows) byId.set(row.id, mapTag(row));
      if (rows.length < TAG_PAGE_SIZE || byId.size === before || rows.length > TAG_PAGE_SIZE) break;
    }
    return [...byId.values()];
  }

  /**
   * Recent articles, for the RSS feed and the Google News sitemap. Paginated because Kal
   * El caps `limit` at 100; stops at the first page wholly older than the cutoff.
   */
  async listRecentNews(since: Date, limit: number): Promise<ArticleSummary[]> {
    const collected: ArticleSummary[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_NEWS_PAGES && collected.length < limit; page += 1) {
      const res = await this.transport.read(kalelArticleListSchema, {
        path: this.transport.sitePath('/articles'),
        query: { status: 'published', ...PUBLISHED_ORDER, limit: INDEX_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        tags: [TAG.news],
        revalidate: REVALIDATE.news,
      });

      const items = await this.summaries(res.items);
      collected.push(...items.filter((a) => a.publishedAt !== null && new Date(a.publishedAt) >= since));

      const everythingOlder =
        items.length > 0 && items.every((a) => a.publishedAt === null || new Date(a.publishedAt) < since);
      if (everythingOlder || !res.nextCursor) break;
      cursor = res.nextCursor;
    }

    return collected.sort(byPublishedDesc).slice(0, limit);
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

  async relationsFor(articleId: string): Promise<ArticleRelations> {
    const dto = await this.transport.read(kalelArticleSchema, {
      path: this.transport.sitePath(`/articles/${articleId}`),
      noStore: true,
    });
    const [categories, tags, authors] = await Promise.all([
      this.fetchCategories(),
      this.fetchTagsByIds(dto.tags),
      this.fetchAuthorRows(),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const authorById = new Map(authors.map((a) => [a.id, a]));
    return {
      categories: dto.categories.map((id) => categoryById.get(id)?.slug).filter((s): s is string => Boolean(s)),
      tags: dto.tags.map((id) => tags.get(id)?.slug).filter((s): s is string => Boolean(s)),
      authors: dto.authors.map((id) => authorById.get(id)?.slug).filter((s): s is string => Boolean(s)),
    };
  }
}

/** A list row reduced to its index entry; null when it has no slug and so no URL. */
function indexEntry(item: KalElArticleSummary): IndexEntry | null {
  if (!item.slug) return null;
  return {
    id: item.id,
    slug: item.slug,
    categoryId: item.categories[0] ?? null,
    tagIds: item.tags,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    title: item.title,
  };
}
