import { describe, expect, it, vi } from 'vitest';

import { SITEMAP_PAGE_SIZE } from '@mn/content';
import { KalElContentRepository } from '../../packages/content/src/kalel/repository';
import { KalElTransport } from '../../packages/content/src/kalel/transport';
import { ARTICLE, ARTICLE_SUMMARY, AUTHOR, CATEGORY, MEDIA, SITE_ID, TAG } from '../contract/kalel-fixtures';

/**
 * H3: an imported archive has ~45k tags and ~70k media rows, and a page shows a handful of
 * each. These pin down that the repository reads only what the page renders — by id, in
 * sorted calls of at most 200 — and that the sitemaps address the archive by offset
 * instead of walking all of it for every file.
 */

type Handler = (url: URL) => Response | Promise<Response>;

function json(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function repository(handler: Handler) {
  const seen: URL[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    seen.push(url);
    return handler(url);
  });
  const transport = new KalElTransport({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.testtokenvalue000000000',
    siteId: SITE_ID,
    timeoutMs: 500,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { repo: new KalElContentRepository({ transport }), seen };
}

/** A uuid whose last twelve digits are `n`, so ids sort the way the numbers do. */
const idOf = (prefix: string, n: number): string => `${prefix}${String(n).padStart(12, '0')}`;
const mediaRow = (n: number) => ({ ...MEDIA, id: idOf('dddd1111-2222-4333-8444-', n) });
const tagRow = (n: number) => ({ ...TAG, id: idOf('bbbb1111-2222-4333-8444-', n), slug: `tag-${n}`, name: `Tag ${n}` });

/** A CMS that honours `ids` and `slug` the way Kal El does since H3. */
function filteringCms(media: ReturnType<typeof mediaRow>[], tags: ReturnType<typeof tagRow>[], extra: Handler) {
  return (url: URL): Response | Promise<Response> => {
    const path = url.pathname;
    if (path.endsWith('/categories')) return json([CATEGORY]);
    if (path.endsWith('/authors')) return json([AUTHOR]);
    if (path.endsWith('/entities')) return json([]);
    if (path.endsWith('/tags')) {
      const ids = url.searchParams.get('ids')?.split(',');
      const slug = url.searchParams.get('slug');
      return json(tags.filter((t) => (!ids || ids.includes(t.id)) && (slug === null || t.slug === slug)));
    }
    if (path.endsWith('/media')) {
      const ids = url.searchParams.get('ids')?.split(',');
      if (!ids) throw new Error(`the library was walked: ${url.search}`);
      const found = media.filter((m) => ids.includes(m.id));
      return json({ items: found, total: found.length });
    }
    return extra(url);
  };
}

describe('KalElContentRepository reads by id', () => {
  it('asks for exactly the covers and tags a listing shows, in one sorted call each', async () => {
    const media = [3, 1, 2].map(mediaRow);
    const tags = [5, 4].map(tagRow);
    const rows = media.map((m, i) => ({
      ...ARTICLE_SUMMARY,
      id: idOf('ffff1111-2222-4333-8444-', i),
      slug: `materia-${i}`,
      featuredMediaId: m.id,
      tags: [tags[i % 2]?.id ?? TAG.id],
    }));
    const { repo, seen } = repository(
      filteringCms(media, tags, (url) =>
        url.pathname.endsWith('/articles')
          ? json({ items: rows, nextCursor: null, total: rows.length })
          : new Response('', { status: 404 }),
      ),
    );

    const page = await repo.listLatest(1);

    expect(page.items).toHaveLength(3);
    expect(page.items.every((a) => a.cover !== null)).toBe(true);
    const mediaCalls = seen.filter((u) => u.pathname.endsWith('/media'));
    expect(mediaCalls.map((u) => u.searchParams.get('ids'))).toEqual([
      media
        .map((m) => m.id)
        .sort()
        .join(','),
    ]);
    const tagCalls = seen.filter((u) => u.pathname.endsWith('/tags'));
    expect(tagCalls.map((u) => u.searchParams.get('ids'))).toEqual([
      tags
        .map((t) => t.id)
        .sort()
        .join(','),
    ]);
  });

  it('reads the images of a body, a gallery and a share card by id, two hundred per call', async () => {
    const media = Array.from({ length: 251 }, (_, i) => mediaRow(i));
    const [cover, social, ...body] = media;
    const article = {
      ...ARTICLE,
      featuredMediaId: cover?.id ?? null,
      document: {
        version: 2 as const,
        nodes: [
          ...body.slice(0, 240).map((m) => ({ type: 'image' as const, attrs: { mediaId: m.id } })),
          { type: 'gallery' as const, attrs: { mediaIds: body.slice(240).map((m) => m.id) } },
        ],
      },
      seo: { ...(ARTICLE.seo ?? {}), socialImageMediaId: social?.id ?? null },
    };
    const { repo, seen } = repository(
      filteringCms(media, [], (url) =>
        url.pathname.includes('/articles/') ? json(article) : new Response('', { status: 404 }),
      ),
    );

    const result = await repo.getArticleById(ARTICLE.id);

    expect(result?.body.filter((b) => b.type === 'image')).toHaveLength(240);
    expect(result?.body.some((b) => b.type === 'gallery')).toBe(true);
    const calls = seen
      .filter((u) => u.pathname.endsWith('/media'))
      .map((u) => u.searchParams.get('ids')?.split(',') ?? []);
    expect(calls.map((ids) => ids.length)).toEqual([200, 51]);
    expect(calls.flat()).toEqual(media.map((m) => m.id).sort());
  });

  it('finds a tag by its slug without reading the vocabulary, and re-checks the match', async () => {
    const tags = [tagRow(1), tagRow(2)];
    const { repo, seen } = repository((url) => {
      // An instance without the filter answers with every tag.
      if (url.pathname.endsWith('/tags')) return json(tags);
      if (url.pathname.endsWith('/categories')) return json([CATEGORY]);
      if (url.pathname.endsWith('/authors')) return json([AUTHOR]);
      if (url.pathname.endsWith('/entities')) return json([]);
      if (url.pathname.endsWith('/articles')) return json({ items: [], nextCursor: null, total: 0 });
      return new Response('', { status: 404 });
    });

    const found = await repo.getTag('tag-2', 1);
    expect(found?.tag.slug).toBe('tag-2');
    expect(await repo.findTags(['tag-9', 'tag-1', 'tag-1'])).toEqual([expect.objectContaining({ slug: 'tag-1' })]);
    expect(
      seen
        .filter((u) => u.pathname.endsWith('/tags'))
        .every((u) => u.searchParams.has('slug') || u.searchParams.has('ids')),
    ).toBe(true);
  });

  it('never asks the CMS for a slug that could not be one', async () => {
    const { repo, seen } = repository(() => new Response('', { status: 500 }));
    expect(await repo.findTags(['../../etc', ''])).toEqual([]);
    expect(seen).toEqual([]);
  });
});

describe('KalElContentRepository sitemaps on a large archive', () => {
  const TOTAL = 12_345;
  const summaryAt = (offset: number) => ({
    ...ARTICLE_SUMMARY,
    id: idOf('ffff1111-2222-4333-8444-', offset),
    slug: `materia-${offset}`,
  });

  function archiveCms() {
    return repository((url) => {
      if (url.pathname.endsWith('/categories')) return json([CATEGORY]);
      if (url.pathname.endsWith('/tags')) return json([]);
      if (url.pathname.endsWith('/articles')) {
        if (url.searchParams.has('cursor')) throw new Error('the archive was walked by cursor');
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        const items = Array.from({ length: Math.max(0, Math.min(limit, TOTAL - offset)) }, (_, i) =>
          summaryAt(offset + i),
        );
        return json({ items, nextCursor: null, total: TOTAL });
      }
      return new Response('', { status: 404 });
    });
  }

  it('counts the files from the total in one call', async () => {
    const { repo, seen } = archiveCms();
    expect(await repo.countSitemapPages()).toBe(Math.ceil(TOTAL / SITEMAP_PAGE_SIZE));
    expect(seen.filter((u) => u.pathname.endsWith('/articles'))).toHaveLength(1);
  });

  it('reads one file by offset, and links the next one', async () => {
    const { repo, seen } = archiveCms();
    const page = await repo.listSitemap('articles', '2');

    expect(page.entries).toHaveLength(SITEMAP_PAGE_SIZE);
    expect(page.entries[0]?.path).toBe(`/${CATEGORY.slug}/materia-${SITEMAP_PAGE_SIZE}`);
    expect(page.nextCursor).toBe('3');
    const offsets = seen
      .filter((u) => u.pathname.endsWith('/articles'))
      .map((u) => Number(u.searchParams.get('offset')));
    expect(Math.min(...offsets)).toBe(SITEMAP_PAGE_SIZE);
    expect(Math.max(...offsets)).toBeLessThan(2 * SITEMAP_PAGE_SIZE);
  });

  it('ends at the last file', async () => {
    const { repo } = archiveCms();
    const last = await repo.listSitemap('articles', '3');
    expect(last.entries).toHaveLength(TOTAL - 2 * SITEMAP_PAGE_SIZE);
    expect(last.nextCursor).toBeNull();
  });

  it('pages the tag vocabulary a thousand at a time and stops at the end', async () => {
    const vocabulary = Array.from({ length: 2500 }, (_, i) => tagRow(i));
    const { repo, seen } = repository((url) => {
      if (!url.pathname.endsWith('/tags')) return new Response('', { status: 404 });
      const offset = Number(url.searchParams.get('offset'));
      return json(vocabulary.slice(offset, offset + Number(url.searchParams.get('limit'))));
    });
    const { entries } = await repo.listSitemap('tags');
    expect(entries).toHaveLength(2500);
    expect(seen).toHaveLength(3);
  });

  it('reads the vocabulary once from an instance that ignores the paging', async () => {
    const vocabulary = Array.from({ length: 2500 }, (_, i) => tagRow(i));
    const { repo, seen } = repository((url) =>
      url.pathname.endsWith('/tags') ? json(vocabulary) : new Response('', { status: 404 }),
    );
    const { entries } = await repo.listSitemap('tags');
    expect(entries).toHaveLength(2500);
    expect(seen).toHaveLength(1);
  });
});
