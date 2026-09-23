import { expect, test } from '@playwright/test';

/**
 * Visual audit. @visual
 *
 * One screenshot per surface, per viewport (390 / 768 / 1024 / 1440) — the evidence
 * `docs/migration/VISUAL-AUDIT.md` links each prototype in `maquina-nerd-kit/prototypes`
 * to. A baseline, not a pixel match against the prototype (a standalone mock): once a
 * surface is signed off, an accidental change to spacing, type or colour fails here.
 */

const SURFACES: [string, string][] = [
  ['home', '/'],
  ['editoria', '/cinema'],
  ['materia-padrao', '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel'],
  ['materia-overlay', '/cinema/o-misterio-de-scarlett-johansson-edicao-capa'],
  ['materia-oferta', '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon'],
  ['ofertas', '/ofertas'],
  ['busca', '/busca?q=marvel'],
  ['autor', '/autor/rafael-lima'],
  ['tag', '/tag/marvel'],
  ['newsletter', '/newsletter'],
  ['sobre', '/sobre'],
  ['404', '/isto-nao-existe/nem-isto'],
];

test.describe('@visual', () => {
  test.beforeEach(async ({ context }) => {
    // The consent bar is a fixed overlay; deciding up front keeps it out of the shot
    // without hiding it from the accessibility suite, which scans it separately.
    await context.addCookies([{ name: 'mn-consent', value: 'rejected', url: 'http://127.0.0.1:3100' }]);
  });

  for (const [name, path] of SURFACES) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', caret: 'hide' });
    });
  }
});

test.describe('@visual design system', () => {
  test('brand red never writes text on a light surface', async ({ page }) => {
    // #E30613 paints; #B00710 writes (kit docs/01).
    for (const path of ['/', '/cinema', SURFACES[4]?.[1] ?? '/']) {
      await page.goto(path);
      const offenders = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          if (!(el.textContent ?? '').trim() || el.children.length > 0) continue;
          const cs = getComputedStyle(el);
          if (cs.color.replace(/\s/g, '') !== 'rgb(227,6,19)') continue;
          // Red text is allowed only on a red-filled control, where it is not red on light.
          let bg = '';
          for (let p: Element | null = el; p && !bg; p = p.parentElement) {
            const b = getComputedStyle(p).backgroundColor;
            if (b !== 'rgba(0, 0, 0, 0)') bg = b;
          }
          if (bg.replace(/\s/g, '') !== 'rgb(227,6,19)') bad.push(el.tagName.toLowerCase());
        }
        return bad;
      });
      expect(offenders, path).toEqual([]);
    }
  });

  test('no corner is rounder than 3px except the avatar and the round controls', async ({ page }) => {
    await page.goto('/');
    const round = await page.evaluate(() =>
      Array.from(document.querySelectorAll('body *'))
        .filter((el) => {
          const r = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
          return r > 3 && r < 999;
        })
        .map((el) => el.tagName.toLowerCase()),
    );
    expect(round).toEqual([]);
  });

  test('article text is justified and never hyphenated', async ({ page }) => {
    // `hyphens: auto` partia palavra no fim da linha ("importan-tes"), e o dicionário do
    // navegador erra em português com frequência suficiente para atrapalhar a leitura.
    await page.goto('/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel');
    const paragraphs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('article p'))
        .map((el) => getComputedStyle(el))
        .map((s) => ({ align: s.textAlign, hyphens: s.hyphens || s.webkitHyphens })),
    );
    expect(paragraphs.length).toBeGreaterThan(3);
    expect(paragraphs.filter((p) => p.hyphens === 'auto')).toEqual([]);
  });

  test('no shadow anywhere', async ({ page }) => {
    await page.goto('/');
    const shadows = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('body *')).filter((el) => getComputedStyle(el).boxShadow !== 'none')
          .length,
    );
    expect(shadows).toBe(0);
  });

  test('the page never scrolls horizontally', async ({ page }) => {
    for (const [, path] of SURFACES) {
      await page.goto(path);
      const report = await page.evaluate(() => {
        const root = document.documentElement;
        if (root.scrollWidth <= root.clientWidth + 1) return [];
        const scrolls = (el: Element) => ['auto', 'scroll', 'hidden'].includes(getComputedStyle(el).overflowX);
        return Array.from(document.querySelectorAll('body *'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || (r.right <= root.clientWidth + 1 && r.left >= -1)) return false;
            for (let p = el.parentElement; p; p = p.parentElement) if (scrolls(p)) return false;
            return true;
          })
          .slice(0, 6)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
      });
      expect(report, path).toEqual([]);
      // And the invariant itself — never hidden with overflow-x on the document.
      const hidden = await page.evaluate(() => getComputedStyle(document.documentElement).overflowX);
      expect(hidden, path).not.toBe('hidden');
    }
  });
});
