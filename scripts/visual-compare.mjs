#!/usr/bin/env node
/**
 * Puts a prototype and its route side by side, at a real viewport, as files.
 *
 * The Definition of Done asks for a human comparison against each `*.dc.html`, and a
 * baseline suite cannot supply one: baselines prove the site has not changed since it was
 * approved, which says nothing about whether it matches the design. This produces the
 * evidence that comparison needs — the same surface, the same width, captured from the
 * prototype and from the application — and writes both into `artifacts/visual/` so a
 * reviewer can flip between them.
 *
 *   pnpm visual:compare                       # every surface, 390/768/1024/1440
 *   pnpm visual:compare -- --only home        # one surface
 *   pnpm visual:compare -- --width 768        # one width
 *
 * The prototypes are opened from disk (`file://`): the kit's `support.js` renders them from
 * the file location and leaves an empty page when served over HTTP. The only prerequisites
 * are the kit copy under `.migration-reference/maquina-nerd-kit/` and the application up
 * in fixture mode (`VISUAL_APP_URL`, default http://127.0.0.1:3210).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const REFERENCE = path.resolve('.migration-reference/maquina-nerd-kit/prototypes');
const OUT = path.resolve('artifacts/visual');
const APP = process.env.VISUAL_APP_URL ?? 'http://127.0.0.1:3210';

/**
 * The seven prototypes of the kit (README) and the route that serves each. The design
 * system and the index are references, not pages: there is no route to compare them with,
 * so only the prototype is captured and the comparison is made against the tokens.
 */
const SURFACES = [
  { key: 'home', proto: 'Máquina Nerd Template.dc.html', route: '/' },
  { key: 'editoria', proto: 'Máquina Nerd Categorias.dc.html', route: '/cinema' },
  {
    key: 'materia',
    proto: 'Máquina Nerd Notícias.dc.html',
    route: '/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel',
  },
  {
    key: 'materia-overlay',
    proto: 'Máquina Nerd Notícias Overlay.dc.html',
    route: '/cinema/o-misterio-de-scarlett-johansson-edicao-capa',
  },
  {
    key: 'materia-oferta',
    proto: 'Máquina Nerd Notícias Publi.dc.html',
    route: '/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon',
  },
  { key: 'design-system', proto: 'Máquina Nerd Design System.dc.html', route: null },
  { key: 'indice', proto: 'Máquina Nerd Índice.dc.html', route: null },
];

/** Navigates and waits until the page is genuinely painted and settled. */
async function load(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  const consent = page.getByRole('button', { name: /Aceitar|Recusar|Apenas essenciais/ });
  if ((await consent.count()) > 0) {
    await consent
      .first()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(250);
  }
  // Scrolls once to the end so lazy images load, then back to the top.
  await page.evaluate(
    () =>
      new Promise((done) => {
        let y = 0;
        const step = setInterval(() => {
          window.scrollTo(0, y);
          y += 600;
          if (y > document.body.scrollHeight) {
            clearInterval(step);
            window.scrollTo(0, 0);
            done(undefined);
          }
        }, 40);
      }),
  );
  await page.waitForTimeout(800);
}

async function capture(page, url, file) {
  await load(page, url);
  await page.screenshot({ path: file, fullPage: true });
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const widths = args.includes('--width') ? [Number(args[args.indexOf('--width') + 1])] : [390, 768, 1024, 1440];
  const surfaces = only ? SURFACES.filter((s) => s.key === only) : SURFACES;

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  await mkdir(OUT, { recursive: true });

  const index = [];
  let failures = 0;
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      // The consent bar is answered up front so it does not cover the app captures.
      await context.addCookies([{ name: 'mn-consent', value: 'rejected', url: APP }]);
      const page = await context.newPage();
      for (const surface of surfaces) {
        const protoFile = path.join(OUT, `${surface.key}-${width}-proto.png`);
        const appFile = surface.route ? path.join(OUT, `${surface.key}-${width}-app.png`) : null;
        try {
          await capture(page, pathToFileURL(path.join(REFERENCE, surface.proto)).href, protoFile);
          if (appFile && surface.route) await capture(page, `${APP}${surface.route}`, appFile);
          index.push({
            surface: surface.key,
            width,
            proto: surface.proto,
            route: surface.route,
            files: [path.basename(protoFile), ...(appFile ? [path.basename(appFile)] : [])],
          });
          console.warn(`  ${surface.key} @ ${width}`);
        } catch (err) {
          failures += 1;
          console.error(`  ${surface.key} @ ${width} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ app: APP, captured: index }, null, 2));
  console.warn(`\n${index.length} captures in ${OUT}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
