import { describe, expect, it, vi } from 'vitest';

import { FixtureContentRepository } from '@mn/content';
import { KalElContentRepository } from '../../packages/content/src/kalel/repository';
import { KalElTransport } from '../../packages/content/src/kalel/transport';
import { ARTICLE, ARTICLE_SUMMARY, AUTHOR, CATEGORY, MEDIA, SITE_ID, TAG } from '../contract/kalel-fixtures';

/**
 * Repository behaviour against a stubbed CMS.
 *
 * The interesting cases are the ones the real Kal El forces on the adapter: no
 * article-by-slug endpoint, cursor pagination with no total, and a taxonomy that arrives
 * as bare UUID arrays.
 */

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

function stubCms(handler: Handler) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(new URL(String(input)), init));
}

function json(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function taxonomyRoutes(url: URL): Response | null {
  if (url.pathname.endsWith('/categories')) return json([CATEGORY]);
  if (url.pathname.endsWith('/tags')) return json([TAG]);
  if (url.pathname.endsWith('/authors')) return json([AUTHOR]);
  if (url.pathname.endsWith('/entities')) return json([]);
  if (url.pathname.endsWith('/media')) return json({ items: [MEDIA], nextCursor: null });
  return null;
}

function repository(handler: Handler) {
  const fetchImpl = stubCms(handler);
  const transport = new KalElTransport({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.testtokenvalue000000000',
    siteId: SITE_ID,
    timeoutMs: 500,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { repo: new KalElContentRepository({ transport }), fetchImpl };
}

describe('KalElContentRepository article resolution', () => {
  it('uses the slug filter when the CMS honours it', async () => {
    const seen: string[] = [];
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        seen.push(url.searchParams.get('slug') ?? '');
        return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      }
      if (url.pathname.includes('/articles/')) return json(ARTICLE);
      return new Response('', { status: 404 });
    });

    const article = await repo.getArticleBySlug(ARTICLE_SUMMARY.slug);
    expect(article?.slug).toBe(ARTICLE_SUMMARY.slug);
    expect(seen).toContain(ARTICLE_SUMMARY.slug);
  });

  it('does not trust an unfiltered answer: a wrong slug falls back to a scan', async () => {
    const otherSummary = { ...ARTICLE_SUMMARY, id: 'aaaa9999-2222-4333-8444-555566667777', slug: 'outra-materia' };
    let listCalls = 0;
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        listCalls += 1;
        // An unpatched Kal El ignores `slug` and answers with the newest article.
        if (url.searchParams.has('slug')) return json({ items: [otherSummary], nextCursor: null });
        return json({ items: [otherSummary, ARTICLE_SUMMARY], nextCursor: null });
      }
      if (url.pathname.includes('/articles/')) return json(ARTICLE);
      return new Response('', { status: 404 });
    });

    const article = await repo.getArticleBySlug(ARTICLE_SUMMARY.slug);
    expect(article?.slug).toBe(ARTICLE_SUMMARY.slug);
    // The filtered call plus at least one scan page.
    expect(listCalls).toBeGreaterThan(1);
  });

  it('returns null when the filter matched nothing at all', async () => {
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [], nextCursor: null });
      return new Response('', { status: 404 });
    });
    expect(await repo.getArticleBySlug('nao-existe')).toBeNull();
  });

  it('refuses to serve an article under a category that is not its own', async () => {
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      if (url.pathname.includes('/articles/')) return json(ARTICLE);
      return new Response('', { status: 404 });
    });
    expect(await repo.getArticle('filmes', ARTICLE_SUMMARY.slug)).toBeNull();
    expect(await repo.getArticle('series', ARTICLE_SUMMARY.slug)).not.toBeNull();
  });

  it('rejects an invalid slug before it reaches the CMS', async () => {
    const { repo, fetchImpl } = repository(() => new Response('', { status: 500 }));
    expect(await repo.getArticleBySlug('../../etc/passwd')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('hides an unpublished article from a non-preview read', async () => {
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      if (url.pathname.includes('/articles/')) return json({ ...ARTICLE, status: 'draft' });
      return new Response('', { status: 404 });
    });
    expect(await repo.getArticleById(ARTICLE.id)).toBeNull();
    expect(await repo.getArticleById(ARTICLE.id, { preview: true })).not.toBeNull();
  });
});

describe('KalElContentRepository ordering', () => {
  const older = {
    ...ARTICLE_SUMMARY,
    id: 'aaaa1111-2222-4333-8444-555566667777',
    slug: 'antiga',
    publishedAt: '2019-01-01T10:00:00Z',
    updatedAt: '2026-09-01T12:00:05Z',
  };
  const newer = {
    ...ARTICLE_SUMMARY,
    id: 'aaaa2222-2222-4333-8444-555566667777',
    slug: 'nova',
    publishedAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z',
  };

  it('asks the CMS for publication order and an offset window', async () => {
    const seen: URLSearchParams[] = [];
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        seen.push(url.searchParams);
        return json({ items: [newer, older], nextCursor: null, total: 2 });
      }
      return new Response('', { status: 404 });
    });
    const page = await repo.listLatest(2, { perPage: 4, skip: 8 });
    expect(seen[0]?.get('order')).toBe('published');
    expect(seen[0]?.get('offset')).toBe('12');
    expect(page.total).toBe(0);
  });

  it('sorts by publication even when an instance returns update order', async () => {
    // An imported archive: the 2019 article was *written* last, at import time.
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [older, newer], nextCursor: null });
      return new Response('', { status: 404 });
    });
    const page = await repo.listLatest(1);
    expect(page.items.map((a) => a.slug)).toEqual(['nova', 'antiga']);
  });

  it('walks the cursor when the instance ignores offset, rather than repeating page 1', async () => {
    const corpus = Array.from({ length: 30 }, (_, i) => ({
      ...ARTICLE_SUMMARY,
      id: `eeee${String(i).padStart(4, '0')}-2222-4333-8444-555566667777`,
      slug: `materia-${i}`,
      publishedAt: new Date(Date.UTC(2026, 8, 30 - i)).toISOString(),
    }));
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        // An unpatched Kal El: no `total`, `offset` ignored, cursor only.
        const cursor = Number(url.searchParams.get('cursor') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 25);
        const next = cursor + limit < corpus.length ? String(cursor + limit) : null;
        return json({ items: corpus.slice(cursor, cursor + limit), nextCursor: next });
      }
      return new Response('', { status: 404 });
    });
    const second = await repo.listLatest(2, { perPage: 10 });
    expect(second.items[0]?.slug).toBe('materia-10');
    expect(second.total).toBe(30);
  });
});

describe('KalElContentRepository bounds', () => {
  it('does not walk the archive for a page number no reader reaches', async () => {
    let calls = 0;
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        calls += 1;
        return json({ items: [ARTICLE_SUMMARY], nextCursor: `c${calls}` });
      }
      return new Response('', { status: 404 });
    });
    const page = await repo.listLatest(9999, { perPage: 9 });
    expect(page.items).toEqual([]);
    // The offset attempt only; no walk is started for a window past the bound.
    expect(calls).toBe(1);
  });

  it('stops walking at the bound even when the CMS keeps answering with a cursor', async () => {
    let calls = 0;
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        calls += 1;
        return json({
          items: [{ ...ARTICLE_SUMMARY, id: `cccc${String(calls).padStart(4, '0')}-2222-4333-8444-555566667777` }],
          nextCursor: `c${calls}`,
        });
      }
      return new Response('', { status: 404 });
    });
    await repo.listLatest(100, { perPage: 10 });
    expect(calls).toBeLessThanOrEqual(21);
  });
});

describe('KalElContentRepository offers and reserved tags', () => {
  const oferta = { ...TAG, id: 'bbbb0001-2222-4333-8444-555566667777', slug: 'oferta', name: 'Oferta' };
  const afiliado = { ...TAG, id: 'bbbb0002-2222-4333-8444-555566667777', slug: 'afiliado', name: 'Afiliado' };
  const row = (n: number, tag: { id: string }) => ({
    ...ARTICLE_SUMMARY,
    id: `dddd${String(n).padStart(4, '0')}-2222-4333-8444-555566667777`,
    slug: `oferta-${n}`,
    publishedAt: new Date(Date.UTC(2026, 8, 10 - n)).toISOString(),
    tags: [tag.id],
  });

  function offersCms(byTag: Record<string, unknown[]>) {
    return repository((url) => {
      if (url.pathname.endsWith('/tags')) return json([TAG, oferta, afiliado]);
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) {
        return json({ items: byTag[url.searchParams.get('tagId') ?? ''] ?? [], nextCursor: null });
      }
      return new Response('', { status: 404 });
    });
  }

  it('lists an article under every offer synonym, once, newest first', async () => {
    const shared = row(2, oferta);
    const { repo } = offersCms({
      [oferta.id]: [row(1, oferta), shared],
      [afiliado.id]: [row(3, afiliado), shared],
    });
    const page = await repo.listOffers(1, { perPage: 10 });
    expect(page.items.map((a) => a.slug)).toEqual(['oferta-1', 'oferta-2', 'oferta-3']);
    expect(page.total).toBe(3);
    expect(page.items.every((a) => a.layout === 'offer')).toBe(true);
  });

  it('keeps reserved tags out of the tag sitemap', async () => {
    const { repo } = offersCms({});
    const { entries } = await repo.listSitemap('tags');
    const paths = entries.map((e) => e.path);
    expect(paths).toContain(`/tag/${TAG.slug}`);
    expect(paths).not.toContain('/tag/oferta');
    expect(paths).not.toContain('/tag/afiliado');
  });
});

describe('KalElContentRepository resilience', () => {
  it('surfaces a CMS outage as an error rather than an empty page', async () => {
    const { repo } = repository(() => new Response('', { status: 503 }));
    await expect(repo.listLatest(1)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('reports a paginated listing without inventing a total it cannot know', async () => {
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [ARTICLE_SUMMARY], nextCursor: 'next-page' });
      return new Response('', { status: 404 });
    });
    const page = await repo.listCategory('series', 1);
    expect(page.total).toBeNull();
    expect(page.totalPages).toBeNull();
    expect(page.hasNext).toBe(true);
  });
});

describe('FixtureContentRepository', () => {
  const repo = new FixtureContentRepository();

  it('fills every section the home prototype has', async () => {
    const latest = await repo.listLatest(1, { perPage: 8 });
    expect(latest.items).toHaveLength(8);
    const needs: Record<string, number> = {
      cinema: 6,
      'series-e-tv': 4,
      games: 4,
      quadrinhos: 4,
      animes: 3,
      videos: 5,
    };
    for (const [slug, n] of Object.entries(needs)) {
      const page = await repo.listCategory(slug, 1, { perPage: 14 });
      expect(page.items.length, slug).toBeGreaterThanOrEqual(n);
    }
  });

  it('lists newest publication first', async () => {
    const { items } = await repo.listLatest(1, { perPage: 20 });
    const times = items.map((a) => Date.parse(a.publishedAt ?? ''));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('covers the three page layouts of the kit', async () => {
    const { items } = await repo.listLatest(1, { perPage: 100 });
    expect(new Set(items.map((a) => a.layout))).toEqual(new Set(['standard', 'overlay', 'offer']));
  });

  it('gives the offer page a product marked as a demonstration price', async () => {
    const article = await repo.getArticleBySlug('controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon');
    const product = article?.body.find((b) => b.type === 'product');
    if (product?.type !== 'product') throw new Error('expected a product block');
    expect(product.product.demo).toBe(true);
    expect(product.product.offers.length).toBeGreaterThan(0);
  });

  it('skips the opening items so page 2 never repeats page 1', async () => {
    const opening = await repo.listCategory('cinema', 1, { perPage: 8 });
    const list = await repo.listCategory('cinema', 1, { skip: 8, perPage: 10 });
    const ids = new Set(opening.items.map((a) => a.id));
    expect(list.items.some((a) => ids.has(a.id))).toBe(false);
  });

  it('paginates deterministically, and a page past the end is empty', async () => {
    const first = await repo.listCategory('cinema', 1, { perPage: 4 });
    const beyond = await repo.listCategory('cinema', 99, { perPage: 4 });
    expect(first.page).toBe(1);
    expect(first.hasNext).toBe(true);
    expect(beyond.items).toEqual([]);
    expect(beyond.hasNext).toBe(false);
  });

  it('answers search with no match as an empty page, not an error', async () => {
    const result = await repo.search('zzzzzzzz', 1);
    expect(result.items).toEqual([]);
  });

  it('refuses a one-letter query rather than scanning the corpus', async () => {
    expect((await repo.search('a', 1)).items).toEqual([]);
  });

  it('produces sitemap entries for every published article, offers under /ofertas', async () => {
    const page = await repo.listSitemap('articles');
    expect(page.entries.length).toBeGreaterThan(5);
    for (const entry of page.entries) expect(entry.path.startsWith('/')).toBe(true);
    expect(
      page.entries.some((e) => e.path === '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon'),
    ).toBe(true);
    expect(
      page.entries.some((e) => e.path === '/games/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon'),
    ).toBe(false);
  });

  it('never lists the draft outside a preview', async () => {
    expect(await repo.getArticleBySlug('rascunho-de-demonstracao')).toBeNull();
    expect(await repo.getArticleBySlug('rascunho-de-demonstracao', { preview: true })).not.toBeNull();
  });
});
