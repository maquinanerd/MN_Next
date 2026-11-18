import { IncrementalCache } from 'next/dist/server/lib/incremental-cache';
import { describe, expect, it, vi } from 'vitest';

import { KalElContentRepository } from '../../packages/content/src/kalel/repository';
import { KalElTransport, readCorrelationId, retryCorrelationId } from '../../packages/content/src/kalel/transport';
import { kalelArticleListSchema } from '../../packages/content/src/kalel/dto';
import { ARTICLE, AUTHOR, CATEGORY, ENTITY_BRAND, SITE_ID, TAG } from '../contract/kalel-fixtures';

/**
 * A Kal El read Next caches must be the same request every time it is made.
 *
 * Next 15 keys its data cache on the request headers as well as the URL. The transport
 * used to send a fresh `randomUUID()` as `x-correlation-id` on every read, so no cached
 * read ever hit: every render and every ISR regeneration re-read everything from the CMS,
 * and every read added an entry to the in-memory LRU. Measured on 18/11/2026 against the
 * stand-in CMS: 1,507 reads in one build (321 after), 6 reads on every visit to the same
 * `/legado` address (0 after the first). DECISIONS §7.33.
 */

type Seen = { url: string; init: RequestInit };

function transport() {
  const seen: Seen[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ data: { items: [], nextCursor: null } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const t = new KalElTransport({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.testtokenvalue000000000',
    siteId: SITE_ID,
    timeoutMs: 500,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { t, seen };
}

const LIST = {
  path: `/v1/sites/${SITE_ID}/articles`,
  query: { status: 'published', limit: 25 },
  tags: ['home'],
  revalidate: 60,
};

const headersOf = (s: Seen) => Object.fromEntries(new Headers(s.init.headers));

/** The key Next's data cache files this request under — Next's own function, not a copy. */
function nextCacheKey(s: Seen): Promise<string> {
  const init = { ...s.init, signal: undefined };
  return IncrementalCache.prototype.generateCacheKey.call({ fetchCacheKeyPrefix: '' }, s.url, init);
}

describe('Kal El cached reads and the Next data cache key', () => {
  it('sends identical headers for identical cached reads', async () => {
    const { t, seen } = transport();
    await t.read(kalelArticleListSchema, LIST);
    await t.read(kalelArticleListSchema, { ...LIST, query: { ...LIST.query } });

    expect(seen).toHaveLength(2);
    const [first, second] = seen.map(headersOf);
    expect(second).toEqual(first);
    expect(first?.['x-correlation-id']).toMatch(/^kalel-[0-9a-f]{16}$/);
  });

  it('files identical cached reads under one Next cache key', async () => {
    const { t, seen } = transport();
    await t.read(kalelArticleListSchema, LIST);
    await t.read(kalelArticleListSchema, LIST);
    const [a, b] = seen as [Seen, Seen];

    expect(await nextCacheKey(b)).toBe(await nextCacheKey(a));
    // What the transport did before: one header that varies per call is enough to give
    // every read a key of its own. This is what keeps the assertion above meaningful.
    const random = { ...b, init: { ...b.init, headers: { ...headersOf(b), 'x-correlation-id': crypto.randomUUID() } } };
    expect(await nextCacheKey(random)).not.toBe(await nextCacheKey(a));
  });

  it('still tells different reads apart in the logs', async () => {
    const { t, seen } = transport();
    await t.read(kalelArticleListSchema, LIST);
    await t.read(kalelArticleListSchema, { ...LIST, query: { ...LIST.query, offset: 25 } });
    const [a, b] = seen.map(headersOf);
    expect(a?.['x-correlation-id']).not.toBe(b?.['x-correlation-id']);
  });

  it('does not let a caller-supplied id split the cache', async () => {
    const { t, seen } = transport();
    await t.read(kalelArticleListSchema, { ...LIST, correlationId: 'per-request-1' });
    await t.read(kalelArticleListSchema, { ...LIST, correlationId: 'per-request-2' });
    const [a, b] = seen.map(headersOf);
    expect(a?.['x-correlation-id']).toBe(b?.['x-correlation-id']);
  });

  it('keeps an id per call for no-store reads, which never reach the cache', async () => {
    const { t, seen } = transport();
    const search = { path: `/v1/sites/${SITE_ID}/articles`, query: { q: 'marvel' }, noStore: true };
    await t.read(kalelArticleListSchema, search);
    await t.read(kalelArticleListSchema, search);
    await t.read(kalelArticleListSchema, { ...search, correlationId: 'from-the-route' });
    const [a, b, c] = seen.map(headersOf);
    expect(a?.['x-correlation-id']).not.toBe(b?.['x-correlation-id']);
    expect(c?.['x-correlation-id']).toBe('from-the-route');
    expect(seen.every((s) => s.init.cache === 'no-store')).toBe(true);
  });

  it('derives the id from method and full URL only', () => {
    const url = `https://cms.example.com/v1/sites/${SITE_ID}/categories`;
    expect(readCorrelationId(url, {})).toBe(readCorrelationId(url, {}));
    expect(readCorrelationId(url, {})).not.toBe(readCorrelationId(`${url}?limit=1`, {}));
  });
});

describe('a cached read whose answer is unusable', () => {
  /*
   * Next stores any 200 before the transport reads the body, so with the cache hitting, an
   * answer outside the contract — or a proxy's HTML page served with 200 — is handed back
   * for the read's whole window, even after the CMS is fixed. The retry goes under a key
   * of its own, so it reaches the CMS instead of the stored answer.
   */
  function sequence(...bodies: unknown[]) {
    const seen: Seen[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      const body = bodies[Math.min(seen.length - 1, bodies.length - 1)];
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const logs: string[] = [];
    const t = new KalElTransport({
      baseUrl: 'https://cms.example.com',
      token: 'ke_st.testtokenvalue000000000',
      siteId: SITE_ID,
      timeoutMs: 500,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onLog: (event) => logs.push(event),
    });
    return { t, seen, logs };
  }
  const BAD = { data: { items: [{ id: 'not-a-uuid' }], nextCursor: null } };
  const GOOD = { data: { items: [], nextCursor: null } };

  it('retries a contract violation once, at once, under a key of its own — a warning, not an alert, when that answer is good', async () => {
    const { t, seen, logs } = sequence(BAD, GOOD);
    const started = Date.now();
    await expect(t.read(kalelArticleListSchema, LIST)).resolves.toMatchObject({ items: [] });

    expect(seen).toHaveLength(2);
    // The retry is there to change key, not to wait out a blip.
    expect(Date.now() - started).toBeLessThan(90);
    const [first, retry] = seen as [Seen, Seen];
    expect(headersOf(retry)['x-correlation-id']).toMatch(
      new RegExp(`^${headersOf(first)['x-correlation-id'] ?? 'missing'}-r[0-9a-z]+$`),
    );
    expect(await nextCacheKey(retry)).not.toBe(await nextCacheKey(first));
    expect(logs).toEqual(['kalel.read.cached-unusable']);
  });

  it('reports the violation when the CMS keeps answering outside the contract', async () => {
    const { t, seen, logs } = sequence(BAD);
    await expect(t.read(kalelArticleListSchema, LIST)).rejects.toMatchObject({ kind: 'contract' });
    expect(seen).toHaveLength(2);
    expect(logs).toEqual(['kalel.read.cached-unusable', 'kalel.contract.violation']);
  });

  it('keeps the read’s own key when retrying a 5xx, which is never stored', async () => {
    const seen: Seen[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return seen.length === 1
        ? new Response('', { status: 503 })
        : new Response(JSON.stringify(GOOD), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const t = new KalElTransport({
      baseUrl: 'https://cms.example.com',
      token: 'ke_st.testtokenvalue000000000',
      siteId: SITE_ID,
      timeoutMs: 500,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(t.read(kalelArticleListSchema, LIST)).resolves.toMatchObject({ items: [] });
    const [first, retry] = seen.map(headersOf);
    // The good answer lands in the entry the next reader looks up.
    expect(retry?.['x-correlation-id']).toBe(first?.['x-correlation-id']);
  });

  it('retries a 200 that is not JSON under a key of its own', async () => {
    const { t, seen } = sequence('<html>pagina do proxy</html>', GOOD);
    await expect(t.read(kalelArticleListSchema, LIST)).resolves.toMatchObject({ items: [] });
    const [first, retry] = seen.map(headersOf);
    expect(retry?.['x-correlation-id']).not.toBe(first?.['x-correlation-id']);
  });

  it('does not retry a violation on a no-store read, whose answer is always fresh', async () => {
    const { t, seen } = sequence(BAD, GOOD);
    await expect(
      t.read(kalelArticleListSchema, { path: `/v1/sites/${SITE_ID}/articles`, noStore: true }),
    ).rejects.toMatchObject({ kind: 'contract' });
    expect(seen).toHaveLength(1);
  });

  it('does not retry a probe that asked for one attempt', async () => {
    const { t, seen } = sequence(BAD, GOOD);
    await expect(t.read(kalelArticleListSchema, { ...LIST, retry: false })).rejects.toMatchObject({ kind: 'contract' });
    expect(seen).toHaveLength(1);
  });

  it('shares one retry key per address for a minute, so a CMS still wrong is asked once a minute', () => {
    const minute = Date.UTC(2026, 10, 18, 16, 0);
    expect(retryCorrelationId('kalel-x', minute)).toBe(retryCorrelationId('kalel-x', minute + 59_000));
    expect(retryCorrelationId('kalel-x', minute)).not.toBe(retryCorrelationId('kalel-x', minute + 60_000));
  });
});

describe('relationsFor and a taxonomy newer than the cache', () => {
  /** The article fresh from the CMS; the lists as the data cache holds them. */
  function repository(lists: { categories: unknown[]; authors: unknown[]; entities: unknown[] }, article: unknown) {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const { pathname } = new URL(String(input));
      const data = pathname.endsWith(`/articles/${ARTICLE.id}`)
        ? article
        : pathname.endsWith('/categories')
          ? lists.categories
          : pathname.endsWith('/authors')
            ? lists.authors
            : pathname.endsWith('/entities')
              ? lists.entities
              : pathname.endsWith('/tags')
                ? [TAG]
                : null;
      return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const t = new KalElTransport({
      baseUrl: 'https://cms.example.com',
      token: 'ke_st.testtokenvalue000000000',
      siteId: SITE_ID,
      timeoutMs: 500,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return new KalElContentRepository({ transport: t });
  }

  const known = { categories: [CATEGORY], authors: [AUTHOR], entities: [ENTITY_BRAND] };

  it('is not stale when every desk and author is known', async () => {
    const relations = await repository(known, { ...ARTICLE, entities: [ENTITY_BRAND.id] }).relationsFor(ARTICLE.id);
    expect(relations).toMatchObject({
      categories: [CATEGORY.slug],
      authors: [AUTHOR.slug],
      tags: [TAG.slug],
      staleTaxonomy: false,
    });
  });

  it.each([
    ['an author', { ...known, authors: [] }],
    ['a desk', { ...known, categories: [] }],
  ])('is stale when %s is missing from the cached list', async (_, lists) => {
    const relations = await repository(lists, ARTICLE).relationsFor(ARTICLE.id);
    expect(relations.staleTaxonomy).toBe(true);
  });

  it('ignores entities, which only feed an offer label and would purge the whole site', async () => {
    // A new entity, or an entity list that failed to load (`fetchEntities` answers empty).
    const relations = await repository(
      { ...known, entities: [] },
      { ...ARTICLE, entities: [ENTITY_BRAND.id] },
    ).relationsFor(ARTICLE.id);
    expect(relations.staleTaxonomy).toBe(false);
  });

  it('is read against the lists through the cache, the article itself fresh', async () => {
    const seen: Seen[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      const { pathname } = new URL(String(url));
      const data = pathname.endsWith(`/articles/${ARTICLE.id}`) ? ARTICLE : [];
      return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const t = new KalElTransport({
      baseUrl: 'https://cms.example.com',
      token: 'ke_st.testtokenvalue000000000',
      siteId: SITE_ID,
      timeoutMs: 500,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await new KalElContentRepository({ transport: t }).relationsFor(ARTICLE.id);
    const article = seen.find((s) => s.url.endsWith(`/articles/${ARTICLE.id}`));
    const lists = seen.filter((s) => s !== article);
    expect(article?.init.cache).toBe('no-store');
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      const next = (list.init as RequestInit & { next?: { tags?: string[]; revalidate?: number } }).next;
      expect(list.init.cache).toBeUndefined();
      expect(next?.tags).toContain('taxonomy');
      // Without a window Next would not keep the read at all.
      expect(next?.revalidate).toBeGreaterThan(0);
    }
  });
});
