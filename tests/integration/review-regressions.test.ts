import { describe, expect, it, vi } from 'vitest';

import { FixtureContentRepository, articleSlugTag } from '@mn/content';
import { SITEMAP_PAGE_SIZE } from '@mn/content';
import { KalElContentRepository } from '../../packages/content/src/kalel/repository';
import { KalElTransport } from '../../packages/content/src/kalel/transport';
import { grantAllows, createPreviewGrant } from '../../packages/content/src/security/preview';
import { ARTICLE, ARTICLE_SUMMARY, AUTHOR, CATEGORY, MEDIA, SITE_ID, TAG } from '../contract/kalel-fixtures';

/**
 * Regression tests for the findings the Wave 1-2 review raised.
 *
 * Each one reproduces the specific way the code was wrong, so a future refactor that
 * reintroduces it fails here rather than in production.
 */

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

function json(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function repository(handler: Handler) {
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(new URL(String(input)), init),
  );
  const transport = new KalElTransport({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.testtokenvalue000000000',
    siteId: SITE_ID,
    timeoutMs: 500,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { repo: new KalElContentRepository({ transport }), fetchImpl };
}

function taxonomy(url: URL, mediaPages?: (offset: number) => { items: unknown[]; total: number }): Response | null {
  if (url.pathname.endsWith('/categories')) return json([CATEGORY]);
  if (url.pathname.endsWith('/tags')) return json([TAG]);
  if (url.pathname.endsWith('/authors')) return json([AUTHOR]);
  if (url.pathname.endsWith('/entities')) return json([]);
  if (url.pathname.endsWith('/media')) {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return json(mediaPages ? mediaPages(offset) : { items: [MEDIA], total: 1 });
  }
  return null;
}

describe('media index pages by offset, not by cursor', () => {
  it('walks every page until it reaches the reported total', async () => {
    // Kal El answers `{ items, total }` with limit/offset and no cursor. Treating it as
    // cursor-paginated stopped after page one and dropped every older asset.
    const assets = Array.from({ length: 450 }, (_, i) => ({
      ...MEDIA,
      id: `${MEDIA.id.slice(0, 24)}${String(i).padStart(12, '0')}`,
    }));
    const seenOffsets: number[] = [];

    const { repo } = repository((url) => {
      const t = taxonomy(url, (offset) => {
        seenOffsets.push(offset);
        return { items: assets.slice(offset, offset + 200), total: assets.length };
      });
      if (t) return t;
      if (url.pathname.endsWith('/articles')) return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      if (url.pathname.includes('/articles/')) return json(ARTICLE);
      return new Response('', { status: 404 });
    });

    await repo.getHome();
    expect(seenOffsets).toEqual([0, 200, 400]);
  });

  it('stops on an empty page rather than looping', async () => {
    const { repo } = repository((url) => {
      const t = taxonomy(url, () => ({ items: [], total: 999 }));
      if (t) return t;
      if (url.pathname.endsWith('/articles')) return json({ items: [], nextCursor: null });
      return new Response('', { status: 404 });
    });
    const home = await repo.getHome();
    expect(home.lead).toBeNull();
  });
});

describe('preview does not filter to published', () => {
  it('resolves a draft by slug when previewing', async () => {
    const draft = { ...ARTICLE_SUMMARY, status: 'draft' as const };
    const statusesSeen: (string | null)[] = [];

    const { repo } = repository((url) => {
      const t = taxonomy(url);
      if (t) return t;
      if (url.pathname.endsWith('/articles')) {
        statusesSeen.push(url.searchParams.get('status'));
        return json({ items: [draft], nextCursor: null });
      }
      if (url.pathname.includes('/articles/')) return json({ ...ARTICLE, status: 'draft' });
      return new Response('', { status: 404 });
    });

    const article = await repo.getArticleBySlug(ARTICLE_SUMMARY.slug, { preview: true });
    expect(article?.slug).toBe(ARTICLE_SUMMARY.slug);
    // The published filter would have excluded the draft entirely.
    expect(statusesSeen).toContain(null);
  });

  it('still filters to published for a public read', async () => {
    const statusesSeen: (string | null)[] = [];
    const { repo } = repository((url) => {
      const t = taxonomy(url);
      if (t) return t;
      if (url.pathname.endsWith('/articles')) {
        statusesSeen.push(url.searchParams.get('status'));
        return json({ items: [ARTICLE_SUMMARY], nextCursor: null });
      }
      if (url.pathname.includes('/articles/')) return json(ARTICLE);
      return new Response('', { status: 404 });
    });
    await repo.getArticleBySlug(ARTICLE_SUMMARY.slug);
    expect(statusesSeen).toContain('published');
  });
});

describe('slug resolution falls back to the complete index', () => {
  it('finds an article far beyond the first page when the filter is ignored', async () => {
    // Simulates an unpatched Kal El: the `slug` parameter is ignored, so the filtered
    // call answers with the newest article. The target sits on the fourth index page.
    const target = { ...ARTICLE_SUMMARY, id: 'aaaa7777-2222-4333-8444-555566667777', slug: 'materia-antiga' };
    const filler = Array.from({ length: 350 }, (_, i) => ({
      ...ARTICLE_SUMMARY,
      id: `bbbb${String(i).padStart(4, '0')}-2222-4333-8444-555566667777`,
      slug: `preenchimento-${i}`,
    }));
    const corpus = [...filler, target];

    const { repo } = repository((url) => {
      const t = taxonomy(url);
      if (t) return t;
      if (url.pathname.endsWith('/articles')) {
        const cursor = Number(url.searchParams.get('cursor') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 100);
        if (url.searchParams.has('slug')) {
          // The filter is ignored: the newest article comes back regardless.
          return json({ items: [corpus[0]], nextCursor: null });
        }
        const slice = corpus.slice(cursor, cursor + limit);
        const next = cursor + limit < corpus.length ? String(cursor + limit) : null;
        return json({ items: slice, nextCursor: next });
      }
      if (url.pathname.includes('/articles/')) return json({ ...ARTICLE, id: target.id, slug: target.slug });
      return new Response('', { status: 404 });
    });

    const article = await repo.getArticleBySlug('materia-antiga');
    expect(article?.slug).toBe('materia-antiga');
  });

  it('uses the slug cache tag so a publication can purge it precisely', () => {
    expect(articleSlugTag('materia-antiga')).toBe('article-slug:materia-antiga');
  });
});

describe('sitemap enumerates the whole archive', () => {
  const corpus = Array.from({ length: 12_000 }, (_, i) => ({
    ...ARTICLE_SUMMARY,
    id: `ccc${String(i).padStart(5, '0')}-2222-4333-8444-555566667777`,
    slug: `materia-${i}`,
  }));

  function bigArchive() {
    return repository((url) => {
      const t = taxonomy(url);
      if (t) return t;
      if (url.pathname.endsWith('/articles')) {
        const cursor = Number(url.searchParams.get('cursor') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const slice = corpus.slice(cursor, cursor + limit);
        const next = cursor + limit < corpus.length ? String(cursor + limit) : null;
        return json({ items: slice, nextCursor: next });
      }
      return new Response('', { status: 404 });
    });
  }

  it('reports one file per page of the archive', async () => {
    const { repo } = bigArchive();
    expect(await repo.countSitemapPages()).toBe(Math.ceil(corpus.length / SITEMAP_PAGE_SIZE));
  });

  it('serves distinct entries per page number', async () => {
    const { repo } = bigArchive();
    const first = await repo.listSitemap('articles', '1');
    const third = await repo.listSitemap('articles', '3');
    expect(first.entries).toHaveLength(SITEMAP_PAGE_SIZE);
    expect(first.nextCursor).toBe('2');
    expect(third.entries.length).toBeGreaterThan(0);
    expect(third.entries[0]?.path).not.toBe(first.entries[0]?.path);
    expect(third.nextCursor).toBeNull();
  });

  it('returns nothing past the end, so the route can 404', async () => {
    const { repo } = bigArchive();
    const beyond = await repo.listSitemap('articles', '99');
    expect(beyond.entries).toEqual([]);
  });
});

describe('articles with no desk have no public URL', () => {
  it('never appears in a listing', async () => {
    const orphan = { ...ARTICLE_SUMMARY, id: 'dddd7777-2222-4333-8444-555566667777', categories: [] };
    const { repo } = repository((url) => {
      const t = taxonomy(url);
      if (t) return t;
      if (url.pathname.endsWith('/articles')) return json({ items: [orphan, ARTICLE_SUMMARY], nextCursor: null });
      return new Response('', { status: 404 });
    });
    const home = await repo.getHome();
    const ids = [home.lead, ...home.secondary, ...home.aside].filter(Boolean).map((a) => a?.id);
    expect(ids).not.toContain(orphan.id);
  });
});

describe('preview grants are scoped to one article', () => {
  const secret = 'g'.repeat(48);

  it('authorises the slug it was issued for', () => {
    const grant = createPreviewGrant(secret, { slug: 'resident-evil-2026', category: 'series' });
    expect(grantAllows(secret, grant, 'resident-evil-2026')).toBe(true);
  });

  it('does not authorise a different slug', () => {
    // The bug this locks down: draftMode() alone is global, so one valid token would
    // otherwise open every unpublished slug a visitor can guess.
    const grant = createPreviewGrant(secret, { slug: 'resident-evil-2026' });
    expect(grantAllows(secret, grant, 'outro-rascunho')).toBe(false);
  });

  it('rejects a missing or forged grant', () => {
    expect(grantAllows(secret, undefined, 'resident-evil-2026')).toBe(false);
    expect(grantAllows(secret, 'mnp.forged.value', 'resident-evil-2026')).toBe(false);
    const foreign = createPreviewGrant('h'.repeat(48), { slug: 'resident-evil-2026' });
    expect(grantAllows(secret, foreign, 'resident-evil-2026')).toBe(false);
  });

  it('expires', () => {
    const grant = createPreviewGrant(secret, { slug: 'resident-evil-2026' }, -60);
    expect(grantAllows(secret, grant, 'resident-evil-2026')).toBe(false);
  });
});

describe('relationsFor drives targeted invalidation', () => {
  it('reports the desks, tags and authors an article belongs to', async () => {
    const repo = new FixtureContentRepository();
    const article = await repo.getArticleBySlug('resident-evil-2026-revela-mudanca-em-monstro-classico');
    const relations = await repo.relationsFor(article?.id ?? '');
    expect(relations.categories).toContain('series');
    expect(relations.tags).toContain('terror');
    expect(relations.authors).toContain('rafael-lima');
  });

  it('answers empty for an unknown article rather than throwing', async () => {
    const repo = new FixtureContentRepository();
    expect(await repo.relationsFor('nao-existe')).toEqual({ categories: [], tags: [], authors: [] });
  });
});
