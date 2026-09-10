import { expect, test, type Page } from '@playwright/test';

/**
 * The text column is aligned to the header menu (kit docs/03): it starts under the first
 * nav item and is as wide as the nine items. The prototype measures that at runtime; the
 * build does it with a fixed grid (app/globals.css, `.mn-col`), so nothing reflows after
 * load. This is what keeps the fixed numbers honest: if the font, a label or a header box
 * changes, the measured nav moves and the column no longer does — and this fails.
 */

const STANDARD = '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel';
const OFFER = '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon';

async function measure(page: Page, column: string) {
  return page.evaluate((selector) => {
    const items = [...document.querySelectorAll('nav[aria-label="Editorias"] a')];
    const first = items[0]?.getBoundingClientRect();
    const last = items[items.length - 1]?.getBoundingClientRect();
    const col = document.querySelector(selector)?.getBoundingClientRect();
    return {
      navLeft: first?.left ?? 0,
      navWidth: (last?.right ?? 0) - (first?.left ?? 0),
      colLeft: col?.left ?? 0,
      colWidth: col?.width ?? 0,
    };
  }, column);
}

test.describe('text column aligned to the menu', () => {
  test('standard article, above 1181px: same left edge, same width', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'The full-size nav exists from 1181px.');
    await page.goto(STANDARD);
    const m = await measure(page, '.mn-col');
    expect(Math.abs(m.colLeft - m.navLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.colWidth - m.navWidth)).toBeLessThanOrEqual(2);
  });

  test('offer article, above 1181px: same left edge, same width', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'The full-size nav exists from 1181px.');
    await page.goto(OFFER);
    const m = await measure(page, '.mn-col-offer');
    expect(Math.abs(m.colLeft - m.navLeft)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.colWidth - m.navWidth)).toBeLessThanOrEqual(2);
  });

  test('offer article, 901–1180px: starts under the first nav item', async ({ page }, info) => {
    test.skip(info.project.name !== 'laptop-1024', 'The compact nav regime.');
    await page.goto(OFFER);
    const m = await measure(page, '.mn-col-offer');
    expect(Math.abs(m.colLeft - m.navLeft)).toBeLessThanOrEqual(2);
  });

  test('the wide figure bleeds 72px each side above 1240px, and not below', async ({ page }, info) => {
    await page.goto(STANDARD);
    const d = await page.evaluate(() => {
      const col = document.querySelector('.mn-col')?.getBoundingClientRect();
      const fig = document.querySelector('article figure')?.getBoundingClientRect();
      return { left: (col?.left ?? 0) - (fig?.left ?? 0), right: (fig?.right ?? 0) - (col?.right ?? 0) };
    });
    const expected = info.project.name === 'desktop-1440' ? 72 : 0;
    expect(Math.round(d.left)).toBe(expected);
    expect(Math.round(d.right)).toBe(expected);
  });
});
