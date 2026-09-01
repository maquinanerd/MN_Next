import { expect, test } from '@playwright/test';

/**
 * Behavioural coverage of the seven approved surfaces.
 *
 * These assert the things the Definition of Done names as non-negotiable and that a unit
 * test cannot see: one `<h1>`, an ad slot that reserves its height before it loads, tabs
 * that are real links, a commercial disclosure above the headline, and outbound
 * purchase links carrying `rel="sponsored nofollow"`.
 */

const ARTICLE = '/series/resident-evil-2026-revela-mudanca-em-monstro-classico';
const LONGFORM = '/series/como-ahsoka-virou-o-centro-do-plano-galactico-da-disney';
const URGENT = '/series/lanterns-atinge-93-milhoes-de-espectadores-na-estreia-na-hbo';
const VIDEO = '/animes/netflix-revela-trailer-de-lego-one-piece-com-aventura-inedita';
const LIST = '/series/5-coisas-que-o-trailer-de-ahsoka-t2-esconde-sobre-thrawn';
const REVIEW = '/reviews/box-sandman-edicao-definitiva-vale-os-r-289';
const COMMERCIAL = '/ofertas/semana-nerd-2026';

test.describe('every page', () => {
  for (const path of ['/', '/series', ARTICLE, '/especiais', '/reviews', '/busca', '/newsletter']) {
    test(`${path} has exactly one h1 and a skip link`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveCount(1);
    });
  }

  test('the network bar names both portals and marks the current one', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('navigation', { name: 'Portais da rede' });
    await expect(bar.getByRole('link', { name: /Máquina Nerd/ })).toHaveAttribute('aria-current', 'true');
    await expect(bar.getByRole('link', { name: /Cinerie/ })).toBeVisible();
  });

  test('each nav landmark has a distinct accessible name', async ({ page }) => {
    await page.goto(ARTICLE);
    const names = await page
      .locator('nav[aria-label]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(new Set(names).size).toBe(names.length);
  });
});

test.describe('home', () => {
  test('renders the lead, the Cinerie module and the poll', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Destaques' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Onde assistir' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Enquete' })).toBeVisible();
  });

  test('the Cinerie block credits the sibling desk', async ({ page }) => {
    await page.goto('/');
    const block = page.getByRole('region', { name: 'Onde assistir' });
    await expect(block.getByText(/Dados de disponibilidade por/)).toBeVisible();
    await expect(block.getByRole('link', { name: 'Ver no Cinerie' })).toBeVisible();
  });

  test('emits exactly one JSON-LD graph', async ({ page }) => {
    await page.goto('/');
    const blocks = page.locator('script[type="application/ld+json"]');
    await expect(blocks).toHaveCount(1);
    const graph = JSON.parse((await blocks.first().textContent()) ?? '{}');
    const types = graph['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('NewsMediaOrganization');
    expect(types).toContain('WebSite');
  });
});

test.describe('article templates', () => {
  for (const [name, path] of [
    ['standard', ARTICLE],
    ['longform', LONGFORM],
    ['urgent', URGENT],
    ['video', VIDEO],
    ['list', LIST],
  ] as const) {
    test(`${name} renders with metadata and structured data`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(path.replace(/\//g, '\\/')),
      );
      const graph = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}',
      );
      const types = graph['@graph'].map((n: { '@type': string }) => n['@type']);
      expect(types).toContain('BreadcrumbList');
    });
  }

  test('the urgent template shows the live badge and an update timeline', async ({ page }) => {
    await page.goto(URGENT);
    await expect(page.getByText('Ao vivo').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Linha do tempo das atualizações' })).toBeVisible();
  });

  test('the video template loads no third-party frame before a click', async ({ page }) => {
    await page.goto(VIDEO);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: /Carregar vídeo do YouTube/ }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('breadcrumbs match the JSON-LD BreadcrumbList', async ({ page }) => {
    await page.goto(ARTICLE);
    const visible = await page.getByRole('navigation', { name: 'Trilha de navegação' }).locator('li').allInnerTexts();
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}');
    const crumb = graph['@graph'].find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
    expect(crumb.itemListElement).toHaveLength(visible.length);
  });
});

test.describe('category listing', () => {
  test('tabs are real links carrying aria-current', async ({ page }) => {
    await page.goto('/series');
    const tabs = page.getByRole('navigation', { name: 'Abas de editoria' });
    const active = tabs.locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('href', '/series');
  });

  test('page 2 is canonical to itself, never to page 1', async ({ page }) => {
    const response = await page.goto('/series/page/2');
    // The fixture corpus may be shorter than two pages; a 404 is the correct answer then.
    if (response?.status() === 404) test.skip();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/series\/page\/2$/);
  });

  test('a query-paginated listing is canonical to its own URL shape', async ({ page }) => {
    // The canonical builder used to emit /reviews/page/2 for a route that paginates with
    // ?page=2 — a canonical pointing at a URL that does not exist is worse than none.
    for (const [path, expected] of [
      ['/reviews?page=2', /\/reviews\?page=2$/],
      ['/ofertas?page=2', /\/ofertas\?page=2$/],
      ['/autor/rafael-lima?page=2', /\/autor\/rafael-lima\?page=2$/],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute('href', expected);
    }
  });

  test('page 1 of a query-paginated listing is canonical to the bare URL', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/reviews$/);
  });

  test('page 1 redirects to the unpaginated URL', async ({ page }) => {
    await page.goto('/series/page/1');
    expect(new URL(page.url()).pathname).toBe('/series');
  });
});

test.describe('commercial surfaces', () => {
  test('a review shows the disclosure above the headline', async ({ page }) => {
    await page.goto(REVIEW);
    const badge = page.getByText('Contém link de afiliado').first();
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    const headingBox = await page.locator('h1').boundingBox();
    expect(badgeBox && headingBox && badgeBox.y).toBeLessThan(headingBox?.y ?? 0);
  });

  test('every outbound purchase link is sponsored nofollow', async ({ page }) => {
    await page.goto(REVIEW);
    const links = page.locator('a[href^="https://www.amazon"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const rel = (await links.nth(i).getAttribute('rel')) ?? '';
      expect(rel).toContain('sponsored');
      expect(rel).toContain('nofollow');
    }
  });

  test('the verified-at date is visible next to the price', async ({ page }) => {
    await page.goto(REVIEW);
    await expect(page.getByText(/Preço verificado em/)).toBeVisible();
  });

  test('a paid campaign landing is noindex', async ({ page }) => {
    await page.goto(COMMERCIAL);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  });
});

test.describe('advertising reserves its space', () => {
  test('every ad slot has a min-height before anything loads', async ({ page }) => {
    await page.goto('/');
    const slots = page.locator('[data-ad-slot]');
    const count = await slots.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const height = await slots.nth(i).evaluate((el) => Number.parseInt(getComputedStyle(el).minHeight, 10));
      expect(height).toBeGreaterThan(0);
    }
  });

  test('ad slots are not keyboard focusable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-ad-slot][tabindex]')).toHaveCount(0);
    await expect(page.locator('[data-ad-slot]').first()).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('search', () => {
  test('is noindex and shareable by URL', async ({ page }) => {
    await page.goto('/busca?q=resident');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('heading', { level: 2, name: /Resultados para/ })).toBeVisible();
  });

  test('explains an empty result instead of showing a blank page', async ({ page }) => {
    await page.goto('/busca?q=zzzzzzzzzz');
    await expect(page.getByText(/Nada encontrado/)).toBeVisible();
  });

  test('a one-letter query is refused rather than scanned', async ({ page }) => {
    await page.goto('/busca?q=a');
    await expect(page.getByText(/ao menos duas letras/)).toBeVisible();
  });
});

test.describe('discovery surfaces', () => {
  test('robots.txt points at both sitemaps', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain('sitemap.xml');
    expect(body).toContain('news-sitemap.xml');
  });

  test('the sitemap index names every child file', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain('/sitemap/articles-1.xml');
    expect(body).toContain('/sitemap/categories.xml');
    expect(body).toContain('/news-sitemap.xml');
  });

  test('each child sitemap is well-formed XML with absolute URLs', async ({ request }) => {
    for (const path of ['/sitemap/articles-1.xml', '/sitemap/categories.xml', '/sitemap/authors.xml']) {
      const res = await request.get(path);
      expect(res.ok(), path).toBe(true);
      const body = await res.text();
      expect(body.startsWith('<?xml')).toBe(true);
      expect(body).toContain('<loc>http');
    }
  });

  test('a sitemap page past the end is a 404, not an empty file', async ({ request }) => {
    const res = await request.get('/sitemap/articles-99.xml');
    expect(res.status()).toBe(404);
  });

  test('the RSS feed is valid and capped at 30 items', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect((body.match(/<item>/g) ?? []).length).toBeLessThanOrEqual(30);
  });

  test('the news sitemap is a valid news urlset', async ({ request }) => {
    const res = await request.get('/news-sitemap.xml');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
  });
});

test.describe('legacy URLs', () => {
  test('a WordPress category path redirects to the desk', async ({ page }) => {
    await page.goto('/categoria/series');
    expect(new URL(page.url()).pathname).toBe('/series');
  });

  test('a WordPress feed redirects to the RSS route', async ({ request }) => {
    const res = await request.get('/feed', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toContain('/feed.xml');
  });

  test('a removed WordPress endpoint answers 410, never a silent 404', async ({ request }) => {
    const res = await request.get('/wp-json/wp/v2/posts', { maxRedirects: 0 });
    expect(res.status()).toBe(410);
  });

  test('an unknown path renders the 404 page with a way out', async ({ page }) => {
    const response = await page.goto('/isto-nao-existe/nem-isto');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'Ir para a home' })).toBeVisible();
  });
});

test.describe('preview', () => {
  test('is refused without a token', async ({ request }) => {
    const res = await request.get('/api/preview?token=short', { maxRedirects: 0 });
    expect(res.status()).toBe(400);
  });

  test('is refused with an invalid token, and says nothing about why', async ({ request }) => {
    const res = await request.get(`/api/preview?token=mnp.${'a'.repeat(40)}.${'b'.repeat(64)}`, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    expect(res.headers()['x-robots-tag']).toContain('noindex');
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('the preview surface 404s without a session', async ({ page }) => {
    const response = await page.goto('/preview/resident-evil-2026-revela-mudanca-em-monstro-classico');
    expect(response?.status()).toBe(404);
  });
});

test.describe('health', () => {
  test('liveness answers ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBe(true);
    expect((await res.json()).status).toBe('ok');
  });

  test('readiness reports the content source', async ({ request }) => {
    const res = await request.get('/api/health?ready=1');
    expect(res.ok()).toBe(true);
    expect((await res.json()).checks.content).toBe('fixture');
  });
});

test.describe('theme', () => {
  test('the dark theme is applied before paint from the cookie', async ({ page, context }) => {
    await context.addCookies([{ name: 'mn-theme', value: 'dark', url: 'http://127.0.0.1:3100' }]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the toggle announces its state', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Tema/ });
    await expect(toggle).toHaveAttribute('aria-pressed', /true|false/);
  });
});
