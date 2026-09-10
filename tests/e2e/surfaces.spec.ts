import { expect, test } from '@playwright/test';

/**
 * Behaviour of the surfaces the kit defines (maquina-nerd-kit/docs/03), in fixture mode.
 *
 * What a screenshot cannot show: one `<h1>`, the nav and drawer semantics, the order of
 * the home's sections, where the ads land, `rel="sponsored nofollow"` on every purchase
 * link, the redirects that keep the archive's URLs alive.
 */

const STANDARD = '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel';
const OVERLAY = '/cinema/o-misterio-de-scarlett-johansson-edicao-capa';
const OFFER = '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon';

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'mn-consent', value: 'rejected', url: 'http://127.0.0.1:3100' }]);
});

test.describe('every page', () => {
  for (const path of [
    '/',
    '/cinema',
    STANDARD,
    OVERLAY,
    OFFER,
    '/busca?q=marvel',
    '/newsletter',
    '/sobre',
    '/ofertas',
    '/autor/rafael-lima',
    '/tag/marvel',
    '/page/2',
  ]) {
    test(`${path} has exactly one h1 and a skip link`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveCount(1);
    });
  }

  test('each nav landmark has a distinct accessible name', async ({ page }) => {
    await page.goto(STANDARD);
    const names = await page
      .locator('nav[aria-label]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(new Set(names).size).toBe(names.length);
  });

  test('fixture mode says it is a demonstration, on the page and not in the content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('note').filter({ hasText: 'Demonstração' })).toBeVisible();
  });
});

test.describe('header', () => {
  test('nine items in the prototype order, the current editoria filled', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-390', 'The nav is the drawer on a phone.');
    await page.goto('/cinema');
    const nav = page.getByRole('navigation', { name: 'Editorias' });
    await expect(nav.getByRole('link')).toHaveText([
      'Notícias',
      'Cinema',
      'Séries e TV',
      'Games',
      'Quadrinhos',
      'Animes',
      'Vídeos',
      'Especiais',
      'Mais',
    ]);
    const cinema = nav.getByRole('link', { name: 'Cinema' });
    await expect(cinema).toHaveAttribute('aria-current', 'page');
    const fill = await cinema.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fill).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the menu opens the drawer, says so, and Escape closes it', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Abrir menu' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    const close = page.getByRole('button', { name: 'Fechar menu' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    const drawer = page.getByRole('navigation', { name: 'Menu de editorias' });
    await expect(drawer.getByRole('link')).toHaveCount(9);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('the search icon is a real link to the search page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Buscar' })).toHaveAttribute('href', '/busca');
  });
});

test.describe('home', () => {
  test('the sections come in the prototype order', async ({ page }) => {
    await page.goto('/');
    const titles = (await page.locator('main h2').allInnerTexts()).map((t) =>
      t.toLowerCase().replace(/\s+/g, ' ').trim(),
    );
    const expected = [
      'notícias de cinema',
      'games',
      'notícias de séries e tv',
      'animes | especiais',
      'vídeo em destaque',
      'mais do máquina nerd',
    ];
    const positions = expected.map((e) => titles.findIndex((t) => t.startsWith(e)));
    expect(
      positions.every((p) => p >= 0),
      titles.join(' / '),
    ).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test('the feed carries a 728×90 after every third story', async ({ page }) => {
    await page.goto('/');
    const feed = page.locator('section[aria-labelledby="lista-titulo"]');
    await expect(feed.locator('article')).toHaveCount(9);
    await expect(feed.getByRole('group', { name: /728 por 90/ })).toHaveCount(2);
  });

  test('every ad slot on the page has a unique accessible name', async ({ page }) => {
    await page.goto('/');
    const names = await page
      .locator('[data-ad-slot]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(names.length).toBeGreaterThan(4);
    expect(new Set(names).size).toBe(names.length);
  });

  test('emits exactly one JSON-LD graph', async ({ page }) => {
    await page.goto('/');
    const blocks = page.locator('script[type="application/ld+json"]');
    await expect(blocks).toHaveCount(1);
    const graph = JSON.parse((await blocks.first().textContent()) ?? '{}');
    const types = graph['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('NewsMediaOrganization');
    expect(types).toContain('CollectionPage');
  });

  test('the feed paginates to /page/2, canonical to itself', async ({ page }) => {
    const res = await page.goto('/page/2');
    expect(res?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/page\/2$/);
    await expect(page.getByRole('navigation', { name: 'Paginação' }).locator('[aria-current="page"]')).toContainText(
      '2',
    );
  });
});

test.describe('editoria', () => {
  test('title in the text variant, subject filters with "Todos" current', async ({ page }) => {
    await page.goto('/cinema');
    await expect(page.locator('h1')).toHaveText('Cinema');
    const filters = page.getByRole('navigation', { name: 'Assuntos de Cinema' });
    await expect(filters.getByRole('link', { name: 'Todos' })).toHaveAttribute('aria-current', 'page');
    await expect(filters.getByRole('link', { name: 'Marvel' })).toHaveAttribute('href', '/tag/marvel');
  });

  test('a subject with no tag is not offered — a filter never leads to a 404', async ({ page }) => {
    await page.goto('/cinema');
    const hrefs = await page
      .getByRole('navigation', { name: 'Assuntos de Cinema' })
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    for (const href of hrefs) {
      const res = await page.request.get(href ?? '/');
      expect(res.status(), href ?? '').toBe(200);
    }
  });

  test('page 1 redirects to the unpaginated URL', async ({ page }) => {
    await page.goto('/cinema/page/1');
    expect(new URL(page.url()).pathname).toBe('/cinema');
  });

  test('a page past the end is a 404', async ({ page }) => {
    const res = await page.goto('/cinema/page/40');
    expect(res?.status()).toBe(404);
  });
});

test.describe('article — standard', () => {
  test('label, canonical and structured data', async ({ page }) => {
    await page.goto(STANDARD);
    await expect(page.getByText('Cinema · Marvel').first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${STANDARD}$`));
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}');
    const types = graph['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('BreadcrumbList');
    expect(types.some((t: string) => t === 'Article' || t === 'NewsArticle')).toBe(true);
  });

  test('"Mais como este" comes after the first paragraph', async ({ page }) => {
    await page.goto(STANDARD);
    const tags = await page.locator('article > *').evaluateAll((els) => els.map((el) => el.tagName.toLowerCase()));
    const firstP = tags.indexOf('p', tags.indexOf('figure') + 1);
    const box = await page
      .locator('article > section[aria-labelledby="mais-como-este"]')
      .evaluate((el) => Array.from(el.parentElement?.children ?? []).indexOf(el));
    expect(box).toBeGreaterThan(firstP);
  });

  test('the two in-article ads sit between two paragraphs', async ({ page }) => {
    await page.goto(STANDARD);
    const neighbours = await page.locator('article [data-ad-slot]').evaluateAll((slots) =>
      slots.map((slot) => {
        const box = slot.parentElement as HTMLElement;
        return [box.previousElementSibling?.tagName, box.nextElementSibling?.tagName];
      }),
    );
    expect(neighbours).toHaveLength(2);
    for (const pair of neighbours) expect(pair).toEqual(['P', 'P']);
  });

  test('"Atualizado em" appears for a real edit, and no initials disc is drawn', async ({ page }) => {
    await page.goto(STANDARD);
    // The rail carries it from 901px, the byline row below that; one of them is visible.
    await expect(
      page
        .getByText(/tualizado em/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(page.locator('main img[sizes="52px"], main img[sizes="40px"]')).toHaveCount(0);
  });

  test('every share circle is a real share link', async ({ page }) => {
    await page.goto(STANDARD);
    for (const name of [
      'Compartilhar no LinkedIn',
      'Compartilhar no Facebook',
      'Compartilhar no X',
      'Enviar pelo Gmail',
    ]) {
      await expect(page.getByRole('link', { name }).first()).toHaveAttribute('href', /^https:\/\//);
    }
  });
});

test.describe('article — overlay', () => {
  test('the cover comes first with the header on it, the headline in the cover region', async ({ page }) => {
    await page.goto(OVERLAY);
    await expect(page.locator('header img[src*="mn-logo-on-dark"]')).toHaveCount(1);
    await expect(page.getByRole('region', { name: /Como Scarlett Johansson/ }).locator('h1')).toBeVisible();
  });

  test('the skip link lands on the headline', async ({ page }) => {
    await page.goto(OVERLAY);
    await expect(page.locator('#conteudo h1')).toHaveCount(1);
  });
});

test.describe('article — offer', () => {
  test('every outbound purchase link is sponsored nofollow and names its store', async ({ page }) => {
    await page.goto(OFFER);
    const links = page.locator('a[href^="https://www.amazon.com.br"], a[href^="https://www.mercadolivre.com.br"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const rel = (await links.nth(i).getAttribute('rel')) ?? '';
      expect(rel).toContain('sponsored');
      expect(rel).toContain('nofollow');
    }
    await expect(page.getByRole('link', { name: /^Amazon/ })).toBeVisible();
  });

  test('a demonstration price says so, next to the price', async ({ page }) => {
    await page.goto(OFFER);
    await expect(page.getByText('Oferta · link de afiliado')).toBeVisible();
    await expect(page.getByText('preço de demonstração')).toBeVisible();
  });

  test('the affiliate notice, "Leia também" and the sponsored grid are there', async ({ page }) => {
    await page.goto(OFFER);
    await expect(page.getByText(/sem custo adicional para você/)).toBeVisible();
    await expect(page.getByText('Leia também:').first()).toBeVisible();
    const sponsored = page.getByRole('region', { name: 'Conteúdo patrocinado' });
    await expect(sponsored.getByText('Parceiro · Patrocinado').first()).toBeVisible();
  });

  test('the editoria URL of an offer redirects permanently to /ofertas', async ({ request }) => {
    const res = await request.get('/games/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(res.headers()['location']).toContain(OFFER);
  });
});

test.describe('advertising reserves its space', () => {
  test('every slot has its dimensions before anything loads, and is never focusable', async ({ page }) => {
    await page.goto('/');
    const boxes = await page
      .locator('[data-ad-slot]')
      .evaluateAll((els) =>
        els.map((el) => ({ h: el.getBoundingClientRect().height, focusable: el.matches('a, button, [tabindex]') })),
      );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.h).toBeGreaterThanOrEqual(90);
      expect(box.focusable).toBe(false);
    }
  });
});

test.describe('search', () => {
  test('is noindex and shareable by URL', async ({ page }) => {
    await page.goto('/busca?q=marvel');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('heading', { level: 2, name: /Resultados/ })).toBeVisible();
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
  test('robots.txt closes a deployment that is not the real site', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('news-sitemap.xml');
  });

  test('the sitemap index names every child file, and offers sit under /ofertas', async ({ request }) => {
    const index = await (await request.get('/sitemap.xml')).text();
    expect(index).toContain('/sitemap/articles-1.xml');
    const articles = await (await request.get('/sitemap/articles-1.xml')).text();
    expect(articles).toContain(OFFER);
    expect(articles).not.toContain('/games/controle-xbox');
  });

  test('a sitemap page past the end is a 404', async ({ request }) => {
    expect((await request.get('/sitemap/articles-99.xml')).status()).toBe(404);
  });

  test('the RSS feed is valid and capped at 30 items', async ({ request }) => {
    const body = await (await request.get('/feed.xml')).text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect((body.match(/<item>/g) ?? []).length).toBeLessThanOrEqual(30);
  });
});

test.describe('legacy URLs', () => {
  test('the renamed desks redirect in one hop', async ({ request }) => {
    for (const [from, to] of [
      ['/filmes', '/cinema'],
      ['/series', '/series-e-tv'],
      ['/categoria/series', '/series-e-tv'],
      ['/publicidade', '/anuncie'],
    ]) {
      const res = await request.get(from as string, { maxRedirects: 0 });
      expect(res.status(), from).toBe(301);
      expect(new URL(res.headers()['location'] ?? '', 'http://x').pathname, from).toBe(to);
    }
  });

  test('a bare article slug redirects permanently to its editoria', async ({ request }) => {
    const slug = 'pirates-of-the-caribbean-avanca-com-negociacoes-para-johnny-depp';
    const res = await request.get(`/${slug}`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()['location']).toContain(`/cinema/${slug}`);
  });

  test('a bare offer slug redirects to /ofertas', async ({ request }) => {
    const res = await request.get('/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon', { maxRedirects: 0 });
    expect(res.headers()['location']).toContain(OFFER);
  });

  test('a bare tag slug redirects to the tag archive', async ({ page }) => {
    await page.goto('/netflix');
    expect(new URL(page.url()).pathname).toBe('/tag/netflix');
  });

  test('a segment that is neither is a real 404 with a way out', async ({ page }) => {
    const res = await page.goto('/isto-nao-e-nada-disso');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'Ir para a home' })).toBeVisible();
  });

  test('a WordPress endpoint that is gone answers 410', async ({ request }) => {
    expect((await request.get('/wp-json/wp/v2/posts', { maxRedirects: 0 })).status()).toBe(410);
  });

  test('reserved layout tags have no public archive', async ({ request }) => {
    expect((await request.get('/tag/capa-em-tela-cheia')).status()).toBe(404);
  });

  test('reserved tags never enter the sitemap', async ({ request }) => {
    const xml = await (await request.get('/sitemap/tags.xml')).text();
    expect(xml).toContain('/tag/marvel');
    expect(xml).not.toContain('/tag/capa-em-tela-cheia');
    expect(xml).not.toMatch(/\/tag\/oferta</);
  });

  test('an article asked for under another editoria goes to its own', async ({ request }) => {
    const res = await request.get('/games/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toMatch(/\/cinema\/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel$/);
  });

  test('a page number that is not a whole page in range is a 404', async ({ request }) => {
    for (const path of ['/tag/marvel?page=1.5', '/autor/rafael-lima?page=abc', '/ofertas?page=999']) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});

test.describe('preview', () => {
  test('is refused with an invalid token, and says nothing about why', async ({ request }) => {
    const res = await request.get(`/api/preview?token=mnp.${'a'.repeat(40)}.${'b'.repeat(64)}`, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    expect(res.headers()['x-robots-tag']).toContain('noindex');
  });

  test('the preview surface 404s without a grant', async ({ page }) => {
    expect((await page.goto('/preview/rascunho-de-demonstracao'))?.status()).toBe(404);
  });
});

test.describe('health', () => {
  test('liveness and readiness', async ({ request }) => {
    expect((await (await request.get('/api/health')).json()).status).toBe('ok');
    expect((await (await request.get('/api/health?ready=1')).json()).checks.content).toBe('fixture');
  });
});
