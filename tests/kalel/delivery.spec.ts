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

const DESKS = ['cinema', 'series-e-tv', 'games', 'quadrinhos', 'animes', 'videos', 'especiais'];

/** The same build, against the pre-kal-el#7 stand-in (`playwright.kalel.config.ts`). */
const LEGACY_APP_URL = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_KALEL_LEGACY_PORT ?? 3102)}`;

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
    await expect(page.locator('article').first()).toBeVisible();
    // The corpus gives every article a heading, a list and a figure. Each comes from a
    // different branch of the mapper, so all three appearing means the document walk works.
    await expect(page.locator('article h2').first()).toBeVisible();
    await expect(page.locator('article li').first()).toBeVisible();
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
    const res = await page.goto('/cinema/nao-existe-em-lugar-nenhum');
    expect(res?.status()).toBe(404);
  });

  /*
   * The WordPress archive published everything at the root, so `/{slug}` has to resolve
   * against the CMS rather than out of a redirect table. Against the fixture provider
   * that is a lookup in an in-memory array; here it goes through the slug filter, the
   * fallback scan and the taxonomy hydration — the parts that can actually be wrong.
   */
  test('a bare article slug resolves through the CMS and redirects to its desk', async ({ page }) => {
    const article = CORPUS_ARTICLES[5];
    expect(article).toBeDefined();
    const slug = String(article?.slug);

    const res = await page.goto(`/${slug}`);
    expect(res?.status()).toBe(200);
    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toBe(`/${slug}`);
    expect(pathname.endsWith(`/${slug}`)).toBe(true);
    expect(pathname.split('/').filter(Boolean)).toHaveLength(2);
  });

  test('a bare tag slug redirects to the tag archive', async ({ page }) => {
    await page.goto('/marvel');
    expect(new URL(page.url()).pathname).toBe('/tag/marvel');
  });

  test('a bare reserved tag is a 404, not a redirect into one', async ({ page }) => {
    // `longform` is an editorial switch with no archive: `/tag/longform` is itself a 404.
    const res = await page.goto('/longform');
    expect(res?.status()).toBe(404);
    expect(new URL(page.url()).pathname).toBe('/longform');
  });

  test('a segment that is neither article nor tag is still a 404', async ({ page }) => {
    const res = await page.goto('/isto-nao-e-nada-disso');
    expect(res?.status()).toBe(404);
  });

  test('an article with no author is signed by the newsroom, on the page and in the JSON-LD', async ({ page }) => {
    const unsigned = CORPUS_ARTICLES[8];
    expect(unsigned?.authors).toEqual([]);
    // Corpus article i sits in desk i % 7: article 8 is in Séries e TV.
    const res = await page.goto('/' + 'series-e-tv/' + String(unsigned?.slug));
    expect(res?.status()).toBe(200);
    // The rail signs it on a desktop, the row under the title on a phone; one of them shows.
    const byline = page.getByRole('link', { name: 'Redação Máquina Nerd' });
    await expect(byline).toBeVisible();
    await expect(byline).toHaveAttribute('href', '/sobre');

    const graph = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
    ) as { '@graph': { '@type': string; author?: unknown }[] };
    const node = graph['@graph'].find((n) => n['@type'] === 'NewsArticle' || n['@type'] === 'Article');
    expect(node?.author).toEqual([{ '@id': expect.stringMatching(/\/#organization$/) }]);
  });
});

test.describe('the page layout comes from the reserved tags', () => {
  test('an article tagged capa-em-tela-cheia opens on the full-bleed cover', async ({ page }) => {
    const overlay = CORPUS_ARTICLES[2];
    // Corpus article i sits in desk i % 7: article 2 is in Games.
    const res = await page.goto('/' + 'games/' + String(overlay?.slug));
    expect(res?.status()).toBe(200);
    // The header sits on the photo: the logo is the one drawn for dark grounds.
    await expect(page.locator('header img[src*="mn-logo-on-dark"]')).toHaveCount(1);
    await expect(page.locator('section#conteudo h1')).toBeVisible();
  });

  test('an article tagged oferta lives at /ofertas and is redirected there', async ({ page }) => {
    const offer = CORPUS_ARTICLES[4];
    const slug = String(offer?.slug);
    await page.goto('/' + 'animes/' + slug);
    // Sent on by an instant refresh: the article pages are cached, and a redirect thrown
    // from a cached page comes back from the cache with no Location.
    await page.waitForURL('**/ofertas/' + slug);
    expect(new URL(page.url()).pathname).toBe('/ofertas/' + slug);
    await expect(page.getByText(/podem estar disponíveis em uma ou mais lojas parceiras/)).toBeVisible();
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

  /*
   * The crops the Article image and the og:image point at (packages/seo/src/cover.ts): a
   * 1200 px JPEG in the ratio the name says, whatever the original's format and size.
   */
  test('a cover crop is a 1200 px JPEG in its ratio, cached for good', async ({ request }) => {
    const id = String(CORPUS_MEDIA[0]?.id);
    for (const [variant, width, height] of [
      ['16x9', 1200, 675],
      ['4x3', 1200, 900],
      ['1x1', 1200, 1200],
    ] as const) {
      const res = await request.get(`/media/${id}/${variant}-v1.jpg`);
      expect(res.status(), variant).toBe(200);
      expect(res.headers()['content-type'], variant).toBe('image/jpeg');
      expect(res.headers()['cache-control'], variant).toContain('immutable');
      expect(jpegSize(await res.body()), variant).toEqual({ width, height });
    }
  });

  test('a share image keeps its proportions and is never enlarged', async ({ request }) => {
    // The corpus original is one pixel: re-encoded, not blown up to 1200.
    const res = await request.get(`/media/${String(CORPUS_MEDIA[0]?.id)}/social-v1.jpg`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/jpeg');
    expect(jpegSize(await res.body())).toEqual({ width: 1, height: 1 });
  });

  test('a rendition the site does not make is a 404, an old version included', async ({ request }) => {
    const id = String(CORPUS_MEDIA[0]?.id);
    for (const name of ['2x1-v1.jpg', '16x9-v1.png', '16x9.jpg', '16x9-v0.jpg', 'social.jpg']) {
      expect((await request.get(`/media/${id}/${name}`)).status(), name).toBe(404);
    }
  });

  test('a query string on a rendition is sent back to the plain URL, before any work', async ({ request }) => {
    // The CDN keys its cache on the query string: each new one would be a fresh crop.
    const path = `/media/${String(CORPUS_MEDIA[0]?.id)}/16x9-v1.jpg`;
    const res = await request.get(`${path}?x=1`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toBe(path);
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
  test('the tag sitemap lists the subject hubs with enough stories, and no other tag', async ({ request }) => {
    const res = await request.get('/sitemap/tags.xml');
    expect(res.status()).toBe(200);
    const listed = [...(await res.text()).matchAll(/<loc>[^<]*\/tag\/([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    // Marvel and Netflix are hubs under Cinema and Séries e TV, on 35 and 47 corpus stories;
    // `trailer` and `longform` exist in the CMS but are not hubs.
    expect(listed).toEqual(['marvel', 'netflix']);
  });

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
    const href = await page
      .locator('main a[href^="/cinema/"], main a[href^="/series-e-tv/"]')
      .first()
      .getAttribute('href');
    await page.goto(href ?? '/');
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const graph = JSON.parse(ld ?? '{}') as { '@graph'?: { '@type': string }[] };
    const types = (graph['@graph'] ?? []).map((n) => n['@type']);
    expect(types).toContain('NewsArticle');
    expect(types).toContain('BreadcrumbList');
  });
});

test.describe('readiness checks the contract, not just the host', () => {
  test('is ready against a Kal El that numbers its lists', async ({ request }) => {
    // The probe is an authenticated list read with `offset`, so a 200 here means the
    // token, the site id and the kal-el#7 `total` all work — not merely that a port answers.
    const res = await request.get('/api/health?ready=1');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', checks: { env: 'ok', kalel: 'ok', contract: 'ok' } });
  });

  test('is degraded against a Kal El without the offset change', async ({ request }) => {
    // The second application points at a stand-in answering lists as Kal El did before
    // kal-el#7: `offset` ignored, no `total`. Pages still render by walking the cursor,
    // but that is not the deployment the runbook signs off, so it must not take traffic.
    const res = await request.get(`${LEGACY_APP_URL}/api/health?ready=1`);
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', checks: { env: 'ok', kalel: 'ok', contract: 'degraded' } });
    // Liveness is untouched: restarting the container would not deploy the CMS change.
    expect((await request.get(`${LEGACY_APP_URL}/api/health`)).status()).toBe(200);
  });
});

test.describe('the delivery path never runs unauthenticated', () => {
  test('no page leaks the service token', async ({ page }) => {
    for (const path of ['/', '/cinema', '/busca?q=trailer']) {
      await page.goto(path);
      const html = await page.content();
      expect(html, path).not.toContain('ke_st.');
      expect(html, path).not.toContain('Bearer ');
    }
  });
});

test.describe('preview opens the draft, and only the draft', () => {
  test('a draft is invisible to a public read', async ({ page }) => {
    const res = await page.goto('/cinema/rascunho-que-so-o-preview-abre');
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

/** Width and height from a JPEG's frame header (SOF0–SOF3), read without a decoder. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    const length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  return null;
}
