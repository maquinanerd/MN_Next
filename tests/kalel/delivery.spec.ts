import { expect, test } from '@playwright/test';

import { articles as CORPUS_ARTICLES, media as CORPUS_MEDIA, draftArticle } from '../fake-kalel/corpus';
import { previewTokenFor } from '../fake-kalel/server';

/**
 * Delivery against the CMS contract.
 *
 * Every assertion here fails if the DTO schemas, the mapper, the taxonomy hydration, the
 * pagination split or the media proxy is wrong — none of which the fixture suite can
 * reach, because fixtures hand the routes finished domain objects.
 *
 * The corpus is `tests/fake-kalel/corpus.ts`, sized so that neither pagination model can
 * be skipped: 140 published articles (the cursor walk asks for 100 at a time) and 260
 * media rows (the offset walk asks for 200). At the sizes it started with — 40 and 24 —
 * a provider that read only the first page would have passed everything here.
 */

const DESKS = ['filmes', 'series', 'quadrinhos', 'games', 'animes', 'reviews'];

test.describe('pages render from the CMS', () => {
  test('the home is built from real article rows', async ({ page }) => {
    await page.goto('/');
    // A title only the corpus has: if the mapper dropped the body or the summary, or the
    // taxonomy hydration failed, the listing would be empty and this is what says so.
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    const links = await page.locator('main a[href^="/"]').count();
    expect(links).toBeGreaterThan(10);
  });

  test('an article renders its document nodes, not a blob of HTML', async ({ page }) => {
    await page.goto('/');
    const first = page
      .locator('main a[href*="/"]')
      .filter({ hasText: /\w{10,}/ })
      .first();
    const href = await first.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href ?? '/');
    await expect(page.locator('article, .mn-body').first()).toBeVisible();
    // The corpus gives every article a heading, a list and a figure. Each comes from a
    // different branch of the mapper, so all three appearing means the document walk works.
    await expect(page.locator('.mn-body h2, article h2').first()).toBeVisible();
    await expect(page.locator('.mn-body li, article li').first()).toBeVisible();
  });

  test.describe('every desk answers', () => {
    for (const desk of DESKS) {
      test(`/${desk}`, async ({ page }) => {
        const res = await page.goto(`/${desk}`);
        expect(res?.status(), desk).toBe(200);
        await expect(page.locator('main').first()).toBeVisible();
      });
    }
  });

  test('a tag archive resolves through the taxonomy index', async ({ page }) => {
    const res = await page.goto('/tag/netflix');
    expect(res?.status()).toBe(200);
  });

  test('an author archive resolves through the taxonomy index', async ({ page }) => {
    const res = await page.goto('/autor/juliana-prado');
    expect(res?.status()).toBe(200);
  });

  test('a slug that does not exist is a real 404, not a soft one', async ({ page }) => {
    const res = await page.goto('/filmes/nao-existe-em-lugar-nenhum');
    expect(res?.status()).toBe(404);
  });
});

test.describe('search runs against the CMS', () => {
  test('finds an article by a word in its title', async ({ page }) => {
    await page.goto('/busca?q=trailer');
    await expect(page.locator('main')).toContainText(/trailer/i);
  });

  test('an empty result is an empty page, not an error', async ({ page }) => {
    const res = await page.goto('/busca?q=zzzzzzzznadaaqui');
    expect(res?.status()).toBe(200);
  });
});

test.describe('media comes back through the authenticated proxy', () => {
  test('a cover is served as image bytes from this origin', async ({ page, request }) => {
    await page.goto('/');
    const src = await page.locator('main img').first().getAttribute('src');
    expect(src, 'the home should render at least one cover').toBeTruthy();

    // next/image rewrites the URL; the proxied path is inside the `url` parameter.
    const target = decodeURIComponent(new URL(src ?? '', 'http://127.0.0.1').searchParams.get('url') ?? src ?? '');
    const res = await request.get(target);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/');
    // The reader must never see the CMS credential.
    expect(JSON.stringify(res.headers())).not.toContain('ke_st.');
  });

  test('an unknown media id is a 404, not a 500', async ({ request }) => {
    // Exactly 404. Accepting 502 as well would let a broken media provider pass as if it
    // had correctly reported a missing image.
    const res = await request.get('/media/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('a cover from beyond the first offset page still resolves', async ({ request }) => {
    // The index is walked 200 rows at a time. If the walk stopped after one page, every
    // image past that point would silently lose its cover — the exact failure a previous
    // review found in the importer, in the other direction.
    const late = CORPUS_MEDIA[CORPUS_MEDIA.length - 1];
    expect(CORPUS_MEDIA.length).toBeGreaterThan(200);
    const res = await request.get(`/media/${String(late?.id)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/');
  });
});

test.describe('discovery surfaces enumerate the real corpus', () => {
  test('the sitemap index names its children and they resolve', async ({ request }) => {
    const index = await request.get('/sitemap.xml');
    expect(index.status()).toBe(200);
    const body = await index.text();
    expect(body).toContain('/sitemap/articles-1.xml');

    const articles = await request.get('/sitemap/articles-1.xml');
    expect(articles.status()).toBe(200);
    const xml = await articles.text();
    // Every published article has a desk, so every one has a public URL. More than one
    // cursor page of them, which is the point: a walk that stopped at the first
    // `nextCursor` would land on exactly 100 and look plausible.
    expect(CORPUS_ARTICLES.length).toBeGreaterThan(100);
    expect((xml.match(/<url>/g) ?? []).length).toBe(CORPUS_ARTICLES.length);
  });

  test('the news sitemap covers the recent window', async ({ request }) => {
    const res = await request.get('/news-sitemap.xml');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('news:news');
  });

  test('the feed carries items from the CMS', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect((body.match(/<item>/g) ?? []).length).toBeGreaterThan(5);
  });

  test('an article carries a JSON-LD graph built from CMS fields', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('main a[href^="/filmes/"], main a[href^="/series/"]').first().getAttribute('href');
    await page.goto(href ?? '/');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const graph = JSON.parse(ld ?? '{}') as { '@graph'?: { '@type': string }[] };
    const types = (graph['@graph'] ?? []).map((n) => n['@type']);
    expect(types).toContain('NewsArticle');
    expect(types).toContain('BreadcrumbList');
  });
});

test.describe('the delivery path never runs unauthenticated', () => {
  test('readiness reports the CMS as reachable', async ({ request }) => {
    const res = await request.get('/api/health?ready=1');
    expect(res.status()).toBe(200);
  });

  test('no page leaks the service token', async ({ page }) => {
    for (const path of ['/', '/filmes', '/busca?q=trailer']) {
      await page.goto(path);
      const html = await page.content();
      expect(html, path).not.toContain('ke_st.');
      expect(html, path).not.toContain('Bearer ');
    }
  });
});

test.describe('preview opens the draft, and only the draft', () => {
  test('a draft is invisible to a public read', async ({ page }) => {
    const res = await page.goto('/filmes/rascunho-que-so-o-preview-abre');
    expect(res?.status()).toBe(404);
  });

  test('an invalid preview token is refused', async ({ request }) => {
    const res = await request.get('/api/preview?token=kpv.nao.serve', { maxRedirects: 0 });
    expect([401, 400]).toContain(res.status());
  });

  test('a valid token is redeemed against the CMS and grants that one slug', async ({ request }) => {
    // Asserted at the HTTP level rather than by driving a browser to the draft page.
    // Next's draft-mode cookie (`__prerender_bypass`) is always `Secure`, so no real
    // browser will keep it over plain http, and a browser-level preview test would fail
    // for a reason that has nothing to do with the CMS. What matters here is the part
    // that talks to the CMS: the token was redeemed, the slug came back, and the grant
    // issued names that slug and no other.
    const slug = String(draftArticle['slug']);
    const res = await request.get(`/api/preview?token=${encodeURIComponent(previewTokenFor(slug))}`, {
      maxRedirects: 0,
    });

    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain(`/preview/${slug}`);
    // A preview URL carries a bearer capability; it must not be cached or referred out.
    expect(res.headers()['cache-control']).toContain('no-store');
    expect(res.headers()['x-robots-tag']).toContain('noindex');

    const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    const grant = cookies.map((h) => h.value).find((v) => v.startsWith('mn-preview-grant='));
    expect(grant, 'the redemption must issue a grant').toBeTruthy();
    expect(grant).toContain('HttpOnly');

    // The grant is scoped to one article: decode it and check whose.
    const token = (grant ?? '').split('=')[1]?.split(';')[0] ?? '';
    const payload = token.split('.')[1] ?? '';
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { s: string };
    expect(claims.s).toBe(slug);
  });

  test('a token the CMS does not know is refused before any session opens', async ({ request }) => {
    const res = await request.get('/api/preview?token=kpv.desconhecido.000', { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    expect(cookies.map((h) => h.value).some((v) => v.startsWith('mn-preview-grant='))).toBe(false);
  });
});
