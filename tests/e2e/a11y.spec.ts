import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility gate. @a11y
 *
 * axe-core over every surface at WCAG 2.1 A/AA, plus what axe cannot check: the keyboard
 * path, a visible focus ring, touch targets and reduced motion (kit docs/06).
 */

const SURFACES: [string, string][] = [
  ['home', '/'],
  ['editoria', '/cinema'],
  ['editoria (fill escuro)', '/games'],
  ['matéria padrão', '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel'],
  ['matéria overlay', '/cinema/o-misterio-de-scarlett-johansson-edicao-capa'],
  ['matéria oferta', '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon'],
  ['ofertas', '/ofertas'],
  ['mais notícias', '/page/2'],
  ['autor', '/autor/rafael-lima'],
  ['tag', '/tag/marvel'],
  ['busca', '/busca?q=marvel'],
  ['newsletter', '/newsletter'],
  ['sobre', '/sobre'],
  ['anuncie', '/anuncie'],
  ['acessibilidade', '/acessibilidade'],
  ['404', '/isto-nao-existe/nem-isto'],
];

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'mn-consent', value: 'rejected', url: 'http://127.0.0.1:3100' }]);
});

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

function describe(results: Awaited<ReturnType<typeof scan>>): string[] {
  return results.violations.flatMap((v) =>
    v.nodes.map(
      (n) => `${v.id} (${v.impact}) :: ${n.html.slice(0, 160)} :: ${(n.failureSummary ?? '').replace(/\s+/g, ' ')}`,
    ),
  );
}

test.describe('@a11y axe-core', () => {
  for (const [name, path] of SURFACES) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      expect(describe(await scan(page))).toEqual([]);
    });
  }

  test('the open drawer has no violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    expect(describe(await scan(page))).toEqual([]);
  });

  test('the consent bar has no violations', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Preferências de privacidade' })).toBeVisible();
    expect(describe(await scan(page))).toEqual([]);
  });
});

test.describe('@a11y keyboard', () => {
  test('the skip link is the first stop and reaches the content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText(/Ir para o conteúdo/);
    await focused.press('Enter');
    expect(new URL(page.url()).hash).toBe('#conteudo');
  });

  test('every interactive element on an article is reachable and shows focus', async ({ page }) => {
    await page.goto('/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel');
    const outlines = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Tab');
      const style = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return `${cs.outlineStyle}:${cs.outlineWidth}`;
      });
      if (style) outlines.add(style);
    }
    expect([...outlines].every((s) => !s.startsWith('none'))).toBe(true);
  });

  test('no ad slot ever receives focus', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-ad-reserva]')))).toBe(false);
    }
  });

  test('the editoria band opens its list from the keyboard, without script', async ({ page }, info) => {
    test.skip(
      info.project.name === 'desktop-1440' || info.project.name === 'laptop-1024',
      'The band exists at ≤900px.',
    );
    await page.goto('/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel');
    const summary = page.locator('details summary').first();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Nesta editoria (menu)' })).toBeVisible();
  });
});

test.describe('@a11y touch targets', () => {
  test('the primary controls are at least 44px on a phone (kit docs/06)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-390', 'A mobile requirement.');
    await page.goto('/');
    for (const locator of [
      page.getByRole('button', { name: 'Abrir menu' }),
      page.getByRole('link', { name: 'Buscar' }),
    ]) {
      const box = await locator.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    const rows = await page
      .getByRole('navigation', { name: 'Menu de editorias' })
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);
  });

  test('every other control meets WCAG 2.5.8 (24px)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-390', 'A mobile requirement.');
    await page.goto('/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel');
    const small = await page.locator('a, button').evaluateAll((els) =>
      els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // WCAG 2.5.8 exempts a target inside a sentence and a headline's own words.
          const inSentence = Boolean(el.parentElement?.closest('p, li, figcaption, h1, h2, h3, h4, summary'));
          const isSkip = el.textContent?.includes('Ir para o conteúdo');
          if (inSentence || isSkip) return false;
          return r.height < 24 && r.width < 24;
        })
        .map((el) => `${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 30)}`),
    );
    expect(small).toEqual([]);
  });
});

test.describe('@a11y motion', () => {
  test('reduced motion switches off the nav transition', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/cinema');
    const duration = await page
      .locator('.mn-nav-fill')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.05);
    await context.close();
  });
});
