import { expect, test } from '@playwright/test';

/**
 * Visual audit. @visual
 *
 * One screenshot per approved surface, per viewport, per theme — the evidence
 * `docs/migration/VISUAL-AUDIT.md` links each `*.dc.html` prototype to. The point is not
 * pixel-perfection against the prototype (it is a standalone HTML mock, not a build
 * target) but a stable baseline: once a surface is signed off, an accidental change to
 * spacing, type scale or brand colour fails here.
 *
 * Every run masks the ad placeholders and disables animation, so a diff means a real
 * layout change rather than a sampling artefact.
 */

const SURFACES: [string, string][] = [
  ['home', '/'],
  ['categoria', '/series'],
  ['artigo-padrao', '/series/resident-evil-2026-revela-mudanca-em-monstro-classico'],
  ['artigo-longform', '/series/como-ahsoka-virou-o-centro-do-plano-galactico-da-disney'],
  ['artigo-urgente', '/series/lanterns-atinge-93-milhoes-de-espectadores-na-estreia-na-hbo'],
  ['artigo-video', '/animes/netflix-revela-trailer-de-lego-one-piece-com-aventura-inedita'],
  ['artigo-lista', '/series/5-coisas-que-o-trailer-de-ahsoka-t2-esconde-sobre-thrawn'],
  ['especiais-indice', '/especiais'],
  ['especiais-hub', '/especiais/marvel'],
  ['comercial-review', '/reviews/box-sandman-edicao-definitiva-vale-os-r-289'],
  ['comercial-comparativo', '/quadrinhos/os-10-melhores-box-de-quadrinhos-para-comecar-uma-colecao'],
  ['comercial-publieditorial', '/quadrinhos/como-montar-uma-estante-de-colecionador-sem-gastar-o-mes-inteiro'],
  ['comercial-landing', '/ofertas/semana-nerd-2026'],
  ['reviews-indice', '/reviews'],
  ['ofertas-indice', '/ofertas'],
  ['autor', '/autor/rafael-lima'],
  ['tag', '/tag/terror'],
  ['busca', '/busca?q=resident'],
  ['newsletter', '/newsletter'],
  ['sobre', '/sobre'],
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`@visual ${theme}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: 'mn-theme', value: theme, url: 'http://127.0.0.1:3100' }]);
      // The consent banner is a fixed overlay; deciding up front keeps it out of the shot
      // without hiding it from the accessibility suite, which tests it separately.
      await context.addCookies([{ name: 'mn-consent', value: 'rejected', url: 'http://127.0.0.1:3100' }]);
    });

    for (const [name, path] of SURFACES) {
      test(name, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
          fullPage: true,
          // Ad placeholders carry their size label; their content is not the design.
          mask: [page.locator('[data-ad-slot]')],
          animations: 'disabled',
          caret: 'hide',
        });
      });
    }
  });
}

test.describe('@visual design system', () => {
  test('brand red never writes on a light surface', async ({ page }) => {
    // The single easiest rule in the system to break: #E30613 paints, #B00710 writes.
    await page.goto('/');
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const text = (el.textContent ?? '').trim();
        if (text === '' || el.children.length > 0) continue;
        const cs = getComputedStyle(el);
        if (cs.color.replace(/\s/g, '') === 'rgb(227,6,19)') {
          bad.push(`${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test('the page never scrolls horizontally', async ({ page }) => {
    for (const [, path] of SURFACES.slice(0, 8)) {
      await page.goto(path);

      /*
       * The invariant is the document's own scroll width. An element wider than the
       * viewport is fine when it lives in its own `overflow-x: auto` container — the
       * desk tab strip is meant to scroll sideways — so the element scan is used only to
       * explain a failure, never to cause one.
       */
      const report = await page.evaluate(() => {
        const root = document.documentElement;
        const overflows = root.scrollWidth > root.clientWidth + 1;
        if (!overflows) return { overflows, offenders: [] as string[] };

        const scrolls = (el: Element) => {
          const o = getComputedStyle(el).overflowX;
          return o === 'auto' || o === 'scroll' || o === 'hidden';
        };
        const offenders = Array.from(document.querySelectorAll('body *'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.right < 0) return false;
            if (r.right <= root.clientWidth + 1 && r.left >= -1) return false;
            for (let p = el.parentElement; p; p = p.parentElement) if (scrolls(p)) return false;
            return true;
          })
          .slice(0, 6)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.left)}..${Math.round(r.right)}`.slice(
              0,
              110,
            );
          });
        return { overflows, offenders };
      });

      expect(report.offenders, path).toEqual([]);
      expect(report.overflows, path).toBe(false);
    }
  });

  test('nothing renders below the 11px type floor', async ({ page }) => {
    await page.goto('/series/resident-evil-2026-revela-mudanca-em-monstro-classico');
    const tiny = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const text = (el.textContent ?? '').trim();
        if (text === '' || el.children.length > 0) continue;
        const size = Number.parseFloat(getComputedStyle(el).fontSize);
        if (size > 0 && size < 11) bad.push(`${size}px ${el.tagName.toLowerCase()}`);
      }
      return bad;
    });
    expect(tiny).toEqual([]);
  });
});
