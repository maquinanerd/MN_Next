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

describe('KalElContentRepository resilience', () => {
  it('keeps the home up when the Cinerie module is unavailable', async () => {
    const { repo } = repository((url) => {
      const taxonomy = taxonomyRoutes(url);
      if (taxonomy) return taxonomy;
      if (url.pathname.endsWith('/articles')) return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      return new Response('', { status: 404 });
    });
    const home = await repo.getHome();
    expect(home.lead?.slug).toBe(ARTICLE_SUMMARY.slug);
    // Cinerie is not configured in tests, so the module degrades to absence.
    expect(home.whereToWatch).toBeNull();
  });

  it('surfaces a CMS outage as an error rather than an empty page', async () => {
    const { repo } = repository(() => new Response('', { status: 503 }));
    await expect(repo.getHome()).rejects.toMatchObject({ kind: 'unavailable' });
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

  it('renders a home with every module the prototype needs', async () => {
    const home = await repo.getHome();
    expect(home.lead).not.toBeNull();
    expect(home.secondary.length).toBeGreaterThan(0);
    expect(home.sections.length).toBeGreaterThan(0);
    expect(home.whereToWatch?.length).toBeGreaterThan(0);
    expect(home.poll).not.toBeNull();
  });

  it('covers all five approved article templates', async () => {
    const templates = new Set<string>();
    for (const category of ['series', 'filmes', 'quadrinhos', 'animes', 'reviews']) {
      const page = await repo.listCategory(category, 1);
      for (const item of page.items) templates.add(item.template);
    }
    expect([...templates].sort()).toEqual(['list', 'longform', 'standard', 'urgent', 'video']);
  });

  it('exposes a commercial article with offers for the BuyBox', async () => {
    const article = await repo.getArticleBySlug('box-sandman-edicao-definitiva-vale-os-r-289');
    expect(article?.commercial?.kind).toBe('affiliate');
    expect(article?.review?.score).toBeGreaterThan(0);
    expect(article?.body.some((b) => b.type === 'buyBox')).toBe(true);
  });

  it('paginates deterministically', async () => {
    const first = await repo.listCategory('series', 1);
    const beyond = await repo.listCategory('series', 99);
    expect(first.page).toBe(1);
    expect(beyond.page).toBe(first.totalPages);
  });

  it('answers search with no match as an empty page, not an error', async () => {
    const result = await repo.search('zzzzzzzz', 1);
    expect(result.items).toEqual([]);
  });

  it('refuses a one-letter query rather than scanning the corpus', async () => {
    expect((await repo.search('a', 1)).items).toEqual([]);
  });

  it('serves the live event the ao-vivo route needs', async () => {
    const event = await repo.getLiveEvent('comic-con-2026');
    expect(event?.entries.length).toBeGreaterThan(0);
    expect(await repo.getLiveEvent('nao-existe')).toBeNull();
  });

  it('produces sitemap entries for every published article with a desk', async () => {
    const page = await repo.listSitemap('articles');
    expect(page.entries.length).toBeGreaterThan(5);
    for (const entry of page.entries) expect(entry.path.startsWith('/')).toBe(true);
  });
});
