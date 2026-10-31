import type { Page } from '@playwright/test';

import { expect, test } from './opapreco';

/**
 * OpaPreço Ads on the portal, with real-shaped ads (`opapreco.ts` answers for the origin).
 *
 * What the portal owns and these tests pin: where each slot is, that an article never
 * carries more than four, what a slot tells OpaPreço (the page, never the reader), that a
 * client-side navigation brings a slot for the new article, and that an ad arriving does
 * not move the text. Drawing the ad is OpaPreço's script; the tests only check its
 * outcome: `data-op-estado="pronto"`, Shopee links, the affiliate disclosure.
 */

const STANDARD = '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel';
const OVERLAY = '/cinema/o-misterio-de-scarlett-johansson-edicao-capa';
const OFFER = '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon';
const ORDER = ['article-top', 'article-inline-01', 'article-inline-02', 'article-bottom'];

/** OpaPreço's viewport classes: mobile < 768, tablet 768–1023, desktop ≥ 1024. */
function viewportOf(page: Page): 'mobile' | 'tablet' | 'desktop' {
  const width = page.viewportSize()?.width ?? 0;
  return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

function slotKeys(page: Page) {
  return page.locator('op-slot').evaluateAll((els) => els.map((el) => el.getAttribute('slot-key') ?? ''));
}

async function allReady(page: Page) {
  const slots = page.locator('op-slot:not([slot-key="sidebar"])');
  const count = await slots.count();
  for (let i = 0; i < count; i += 1) await expect(slots.nth(i)).toHaveAttribute('data-op-estado', 'pronto');
  return count;
}

test.beforeEach(async ({ context, opapreco }) => {
  // Accepted on purpose, and a cookie planted on OpaPreço's own origin: even with every
  // cookie allowed and one there to send, the ad request carries none.
  await context.addCookies([
    { name: 'mn-consent', value: 'accepted', url: 'http://127.0.0.1:3100' },
    { name: 'rastreio', value: 'leitor-1', domain: 'opapreco.com.br', path: '/', secure: true, sameSite: 'None' },
  ]);
  opapreco.mode = 'ads';
});

test.describe('slots in an article', () => {
  for (const [layout, path] of [
    ['padrão', STANDARD],
    ['overlay', OVERLAY],
    ['oferta', OFFER],
  ] as const) {
    test(`${layout}: the slots in reading order, never more than four`, async ({ page }) => {
      await page.goto(path);
      const keys = await slotKeys(page);
      // A text too short for inline-02 simply has three (the offer fixture is one).
      expect(keys).toEqual(ORDER.filter((k) => keys.includes(k)));
      for (const k of ['article-top', 'article-inline-01', 'article-bottom']) expect(keys).toContain(k);
      expect(keys.length).toBeLessThanOrEqual(4);
    });
  }

  test('article-top sits under the lead and above the text, never above the title', async ({ page }) => {
    await page.goto(STANDARD);
    const place = await page.locator('.mn-op:has(> op-slot[slot-key="article-top"])').evaluate((box) => {
      const title = document.querySelector('main h1');
      return {
        afterTitle: Boolean(title && title.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING),
        previous: box.previousElementSibling?.tagName,
        next: box.nextElementSibling?.tagName,
      };
    });
    expect(place).toEqual({ afterTitle: true, previous: 'P', next: 'P' });
  });

  test('article-bottom follows the text and comes before the next story and the related grid', async ({ page }) => {
    await page.goto(STANDARD);
    const place = await page.locator('.mn-op:has(> op-slot[slot-key="article-bottom"])').evaluate((box) => ({
      previous: box.previousElementSibling?.tagName,
      next:
        box.nextElementSibling?.getAttribute('aria-label') ?? box.nextElementSibling?.getAttribute('aria-labelledby'),
    }));
    expect(place.previous).toBe('ARTICLE');
    expect(['Próxima matéria', 'relacionadas']).toContain(place.next);
  });

  test('every slot fills: Shopee links, the affiliate disclosure, and the text does not move', async ({ page }) => {
    await page.goto(STANDARD);
    expect(await allReady(page)).toBe(4);

    const hrefs = await page
      .locator('op-slot a[href]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const href of hrefs) expect(href).toMatch(/^https:\/\/s\.shopee\.com\.br\//);
    // Nothing of ours around the ad: no redirect route, no link wrapping the slot.
    expect(await page.locator('a op-slot, a .mn-op').count()).toBe(0);

    for (const key of ORDER) {
      const slot = page.locator(`op-slot[slot-key="${key}"]`);
      await slot.scrollIntoViewIfNeeded();
      await expect(slot.getByText(/Links? de afiliado|Oferta afiliada/).first(), key).toBeVisible();
    }

    const shift = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as (PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            })[]) {
              if (!entry.hadRecentInput) total += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(total), 300);
        }),
    );
    expect(shift).toBeLessThan(0.02);
  });

  test('the request carries the page and the article, never the reader', async ({ page, opapreco }) => {
    await page.goto(STANDARD);
    await allReady(page);
    const head = await page.evaluate(() => ({
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
      title: document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '',
    }));
    expect(head.canonical).toMatch(/^https:\/\//);
    expect(head.title).not.toBe('');

    const sent = opapreco.requests.filter((r) => r.body.slotKey.startsWith('article-'));
    expect(sent.map((r) => r.body.slotKey).sort()).toEqual([...ORDER].sort());
    const ids = new Set(sent.map((r) => r.body.page.contentId));
    expect(ids.size).toBe(1);
    for (const { body, headers } of sent) {
      expect(body.siteKey).toBe('maquina-nerd');
      expect(body.page.canonicalUrl).toBe(head.canonical);
      expect(body.page.title).toBe(head.title);
      expect(body.page.section).toBe('cinema');
      expect(body.page.contentId).toBeTruthy();
      expect(body.client.viewport).toBe(viewportOf(page));
      expect(body.mode ?? 'live').toBe('live');
      expect(headers['cookie']).toBeUndefined();
      expect(headers['content-type']).toContain('text/plain');
    }
  });

  test('a click goes straight to the Shopee, and the click beacon goes with it', async ({ page, opapreco }) => {
    await page.goto(STANDARD);
    await allReady(page);
    const link = page.locator('op-slot[slot-key="article-top"] a[href^="https://s.shopee.com.br/"]').first();
    await expect(link).toHaveAttribute('rel', /sponsored/);
    const [shopee] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await shopee.waitForLoadState();
    expect(shopee.url()).toMatch(/^https:\/\/s\.shopee\.com\.br\//);
    await expect.poll(() => opapreco.beacons.filter((b) => b.kind === 'click').length).toBe(1);
    expect(opapreco.beacons.find((b) => b.kind === 'click')?.body).toMatchObject({ token: 'token-de-teste' });
  });

  test('a client-side navigation brings new slots, with the new article in their request', async ({
    page,
    opapreco,
  }) => {
    await page.goto(STANDARD);
    await allReady(page);
    const first = opapreco.requests.length;
    const before = opapreco.requests[0]?.body.page.contentId;

    const next = page.locator('section[aria-labelledby="relacionadas"] a[href^="/"]').first();
    const href = await next.getAttribute('href');
    expect(href).toBeTruthy();
    await next.click();
    await page.waitForURL(`**${href}`);
    await expect.poll(() => opapreco.requests.length - first).toBeGreaterThanOrEqual(2);
    await allReady(page);

    const canonical = await page.evaluate(
      () => document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
    );
    const after = opapreco.requests.slice(first).filter((r) => r.body.slotKey.startsWith('article-'));
    expect(after.length).toBeGreaterThanOrEqual(2);
    for (const { body } of after) {
      expect(body.page.contentId).not.toBe(before);
      expect(body.page.canonicalUrl).toBe(canonical);
    }
  });
});

test.describe('the sidebar slot', () => {
  test('asks for an ad on a desktop only, and fills there', async ({ page, opapreco }) => {
    await page.goto('/');
    const slot = page.locator('op-slot[slot-key="sidebar"]');
    if (viewportOf(page) === 'desktop') {
      await expect(slot).toHaveAttribute('data-op-estado', 'pronto');
      expect(opapreco.requests.filter((r) => r.body.slotKey === 'sidebar')).toHaveLength(1);
    } else {
      await expect(slot).toHaveAttribute('data-op-estado', 'colapsado');
      expect(opapreco.requests.filter((r) => r.body.slotKey === 'sidebar')).toHaveLength(0);
    }
  });
});

test.describe('the side-list slots', () => {
  // `home-01`, `home-02` and `listing-01` come with OpaPreço's contract v1.2.0. The script
  // published today (the copy in fixtures/) does not know them: they must close at once,
  // margin and all, without asking OpaPreço for anything (DECISIONS §7.30).
  test('close without a request while the script does not know them', async ({ page, opapreco }) => {
    for (const [path, keys] of [
      ['/', ['home-01', 'home-02']],
      ['/cinema', ['listing-01']],
    ] as const) {
      await page.goto(path);
      for (const key of keys) {
        await expect(page.locator(`op-slot[slot-key="${key}"]`)).toHaveAttribute('data-op-estado', 'colapsado');
        await expect(page.locator(`.mn-op:has(> op-slot[slot-key="${key}"])`)).toHaveCSS('margin-top', '0px');
      }
    }
    const keys = new Set(opapreco.requests.map((r) => r.body.slotKey));
    for (const key of ['home-01', 'home-02', 'listing-01']) expect(keys.has(key)).toBe(false);
  });
});
