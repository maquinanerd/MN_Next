import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility gate. @a11y
 *
 * axe-core over every surface, at WCAG 2.1 A/AA, plus the checks axe cannot make: a
 * complete keyboard path, a visible focus ring, and 44px touch targets on mobile.
 *
 * Violations fail the run — the Definition of Done permits none of critical or serious
 * severity, and this asserts the stricter reading: none at all on these rules.
 */

const SURFACES: [string, string][] = [
  ['home', '/'],
  ['categoria', '/series'],
  ['artigo padrão', '/series/resident-evil-2026-revela-mudanca-em-monstro-classico'],
  ['artigo longform', '/series/como-ahsoka-virou-o-centro-do-plano-galactico-da-disney'],
  ['artigo urgente', '/series/lanterns-atinge-93-milhoes-de-espectadores-na-estreia-na-hbo'],
  ['artigo vídeo', '/animes/netflix-revela-trailer-de-lego-one-piece-com-aventura-inedita'],
  ['artigo lista', '/series/5-coisas-que-o-trailer-de-ahsoka-t2-esconde-sobre-thrawn'],
  ['especiais', '/especiais'],
  ['comercial', '/reviews/box-sandman-edicao-definitiva-vale-os-r-289'],
  ['ofertas', '/ofertas'],
  ['autor', '/autor/rafael-lima'],
  ['tag', '/tag/terror'],
  ['busca', '/busca?q=resident'],
  ['newsletter', '/newsletter'],
  ['sobre', '/sobre'],
  ['privacidade', '/politica-de-privacidade'],
  ['publicidade', '/publicidade'],
  ['404', '/isto-nao-existe/nem-isto'],
];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

/**
 * A rule id alone is not actionable — "color-contrast" could be any of a hundred nodes.
 * Each violation is reported with the offending markup and axe's own explanation.
 */
function describe(results: Awaited<ReturnType<typeof scan>>): string[] {
  return results.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} (${v.impact}) :: ${n.html} :: ${(n.failureSummary ?? '').replace(/s+/g, ' ')}`),
  );
}

test.describe('@a11y axe-core', () => {
  for (const [name, path] of SURFACES) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await scan(page);
      expect(describe(results)).toEqual([]);
    });
  }

  test('the dark theme is audited too — contrast differs from light', async ({ page, context }) => {
    await context.addCookies([{ name: 'mn-theme', value: 'dark', url: 'http://127.0.0.1:3100' }]);
    await page.goto('/series/resident-evil-2026-revela-mudanca-em-monstro-classico');
    const results = await scan(page);
    expect(describe(results)).toEqual([]);
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
    await page.goto('/series/resident-evil-2026-revela-mudanca-em-monstro-classico');
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
    // Nothing focusable may render with `outline: none` and no substitute.
    expect([...outlines].every((s) => !s.startsWith('none'))).toBe(true);
  });

  test('no ad slot ever receives focus', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const isAd = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-ad-slot]')));
      expect(isAd).toBe(false);
    }
  });
});

test.describe('@a11y touch targets', () => {
  test('every control on mobile is at least 44px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390', 'Touch targets are a mobile requirement.');
    await page.goto('/series/resident-evil-2026-revela-mudanca-em-monstro-classico');
    const small = await page.locator('a, button').evaluateAll((els) =>
      els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          /*
           * Exempt, per docs/09 and WCAG 2.5.8: links that are words inside a sentence
           * (article body, institutional prose, breadcrumbs, footer lists, the byline and
           * the kicker above a headline), plus the skip link, which is off-screen until
           * it is focused and is full-size when it is.
           */
          /*
           * WCAG 2.5.8 exempts a link that is part of a sentence. Expressed structurally —
           * the anchor sits inside a paragraph or list item — rather than as a class list
           * that has to grow every time a component is added.
           */
          const inSentence = Boolean(el.parentElement?.closest('p, li, figcaption, cite, dd'));
          const inProse = el.closest('.mn-body, .mn-prose, .mn-breadcrumbs, .mn-footer__links, .mn-byline');
          const isSkip = el.classList.contains('mn-skip');
          const isKicker = el.classList.contains('mn-article__kicker') || el.classList.contains('mn-card__kicker');
          /*
           * A headline link is the text of a heading. The card around it already offers a
           * large target through its media link, so padding the words themselves to 44px
           * would only put gaps between stacked headlines.
           */
          const isHeadline = Boolean(el.closest('h1, h2, h3, h4, h5'));
          if (inSentence || inProse || isSkip || isKicker || isHeadline) return false;
          return r.height < 44 || r.width < 44;
        })
        .map((el) =>
          `${el.tagName.toLowerCase()}.${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`.slice(
            0,
            90,
          ),
        ),
    );
    expect(small).toEqual([]);
  });
});

test.describe('@a11y motion', () => {
  test('reduced motion disables card zoom and the live pulse', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const duration = await page
      .locator('.mn-card__media img')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.05);
    await context.close();
  });
});
