import { expect, test } from './opapreco';

/**
 * Montserrat is five `next/font/local` calls, one per script, that only work as one family
 * (app/fonts/montserrat.ts, DECISIONS §7.28). The visual suite cannot see a script going
 * missing — the fixtures are Latin text — so this asserts the faces themselves.
 */

/** One character per script, from the part of its range no other file shares. */
const SCRIPTS: [string, string][] = [
  ['latin', 'a'],
  ['latin-ext', 'ł'],
  ['vietnamese', 'ạ'],
  ['cyrillic', 'Ж'],
  ['cyrillic-ext', 'Ѣ'],
];

const ONE_WIDTH = 'The fonts are the same at every width.';

test.describe('Montserrat', () => {
  test('one family draws every script, and the variable names it first', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', ONE_WIDTH);
    await page.goto('/');
    for (const [script, char] of SCRIPTS) {
      const faces = await page.evaluate(
        async (text) => (await document.fonts.load('400 16px Montserrat', text)).length,
        char,
      );
      expect(faces, script).toBe(1);
    }
    const variable = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-montserrat'),
    );
    expect(variable.replace(/["'\s]/g, '')).toBe('Montserrat,MontserratFallback');
  });

  test('preloads the Latin files and nothing else', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', ONE_WIDTH);
    await page.goto('/');
    const preloaded = await page.evaluate(() => {
      const covers = (range: string, code: number) =>
        [...range.matchAll(/U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/gi)].some(([, from = '', to]) => {
          const lo = Number.parseInt(from.replace(/\?/g, '0'), 16);
          const hi = Number.parseInt(to ?? from.replace(/\?/g, 'F'), 16);
          return code >= lo && code <= hi;
        });
      const scriptOf = new Map<string, string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[];
        try {
          rules = Array.from(sheet.cssRules);
        } catch {
          continue; // another origin's sheet cannot be read, and holds no font of ours
        }
        for (const rule of rules) {
          if (!(rule instanceof CSSFontFaceRule)) continue;
          const file = /url\("?([^")]+)"?\)/.exec(rule.style.getPropertyValue('src'))?.[1];
          const range = rule.style.getPropertyValue('unicode-range');
          if (!file) continue;
          scriptOf.set(
            new URL(file, location.href).pathname,
            covers(range, 0x61) ? 'latin' : covers(range, 0x142) ? 'latin-ext' : 'other',
          );
        }
      }
      return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]'))
        .map((link) => scriptOf.get(new URL(link.href).pathname) ?? link.href)
        .sort();
    });
    // Next fills its font manifest by matching the loader's path with forward slashes, so a
    // Windows build preloads no font at all; Linux — CI and the deploy — preloads these two.
    // The web server builds on this machine (playwright.config.ts), so the platform is ours.
    expect(preloaded).toEqual(process.platform === 'win32' ? [] : ['latin', 'latin-ext']);
  });
});
