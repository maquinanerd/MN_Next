#!/usr/bin/env node
/**
 * Puts a prototype and its route side by side, at a real viewport, as files.
 *
 * The Definition of Done asks for a human comparison against each `*.dc.html`, and a
 * baseline suite cannot supply one: baselines prove the site has not changed since it was
 * approved, which says nothing about whether it matches the design. This produces the
 * evidence that comparison needs — the same surface, the same width, the same theme,
 * captured from the prototype and from the application — and writes both into
 * `artifacts/visual/` so a reviewer can flip between them.
 *
 *   pnpm visual:compare                       # every mapped surface, 1440 and 390
 *   pnpm visual:compare -- --only home        # one surface
 *   pnpm visual:compare -- --width 768        # one width
 *
 * It serves the extracted prototypes itself, so the only prerequisite is that
 * `Inspect-Inputs.ps1 -ExtractReferences` has run and the application is up.
 */

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REFERENCE = path.resolve('.migration-reference/claude-design');
const OUT = path.resolve('artifacts/visual');
const APP = process.env.VISUAL_APP_URL ?? 'http://127.0.0.1:3210';
const PROTO_PORT = Number(process.env.VISUAL_PROTO_PORT ?? 4100);

/** Each approved surface, the prototype that defines it and the route that serves it. */
const SURFACES = [
  { key: 'home', proto: 'Máquina Nerd Template.dc.html', route: '/' },
  { key: 'categoria', proto: 'Máquina Nerd Categorias.dc.html', route: '/series' },
  {
    key: 'artigo',
    proto: 'Máquina Nerd Notícias.dc.html',
    route: '/series/resident-evil-2026-revela-mudanca-em-monstro-classico',
  },
  { key: 'especiais', proto: 'Máquina Nerd Especiais.dc.html', route: '/especiais/marvel' },
  {
    key: 'comercial',
    proto: 'Máquina Nerd Comercial.dc.html',
    route: '/reviews/box-sandman-edicao-definitiva-vale-os-r-289',
  },
  { key: 'design-system', proto: 'Máquina Nerd Design System.dc.html', route: '/sobre' },
  { key: 'indice', proto: 'Máquina Nerd Índice.dc.html', route: '/' },
];

/**
 * The five article templates, which live as five screens inside one prototype file.
 *
 * `Máquina Nerd Notícias.dc.html` is not one page: it stacks the five approved article
 * shapes, each behind a `data-screen-label`. Capturing the file whole compares the
 * standard template against a page and the other four against nothing, which is how they
 * went unexamined. Each screen is clipped to its own element instead.
 */
const SCREENS = [
  {
    key: 'artigo-padrao',
    label: 'Notícia padrão',
    route: '/series/resident-evil-2026-revela-mudanca-em-monstro-classico',
  },
  {
    key: 'artigo-longform',
    label: 'Longform',
    route: '/series/como-ahsoka-virou-o-centro-do-plano-galactico-da-disney',
  },
  {
    key: 'artigo-urgente',
    label: 'Urgente',
    route: '/series/lanterns-atinge-93-milhoes-de-espectadores-na-estreia-na-hbo',
  },
  {
    key: 'artigo-video',
    label: 'Vídeo',
    route: '/animes/netflix-revela-trailer-de-lego-one-piece-com-aventura-inedita',
  },
  { key: 'artigo-lista', label: 'Lista', route: '/series/5-coisas-que-o-trailer-de-ahsoka-t2-esconde-sobre-thrawn' },
];

const SCREEN_PROTO = 'Máquina Nerd Notícias.dc.html';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};

function serveReference() {
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '');
      // Confined to the reference folder: the path comes from a URL.
      const file = path.resolve(REFERENCE, rel);
      if (!file.startsWith(REFERENCE)) throw new Error('outside the reference folder');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PROTO_PORT, '127.0.0.1', () => resolve(server)));
}

/** Navigates and waits until the page is genuinely painted and settled. */
async function load(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  // `networkidle` can fire before a stylesheet has been parsed, and a capture taken then
  // shows unstyled markup — which reads as a broken layout rather than as a broken shot.
  await page.waitForFunction(() => document.styleSheets.length > 0, undefined, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  const consent = page.getByRole('button', { name: /Aceitar todos|Apenas essenciais/ });
  if ((await consent.count()) > 0) {
    await consent
      .first()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(250);
  }
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

/**
 * Captures one screen of a multi-screen prototype.
 *
 * The clip runs from the labelled element to the next label, so a screen carries its own
 * banner and stops where the following one starts.
 */
async function captureScreen(page, url, label, file) {
  await load(page, url);
  const box = await page.evaluate((wanted) => {
    const marks = [...document.querySelectorAll('[data-screen-label]')];
    const index = marks.findIndex((m) => (m.getAttribute('data-screen-label') ?? '').trim() === wanted);
    if (index < 0) return null;
    const start = marks[index].getBoundingClientRect().top + window.scrollY;
    const next = marks[index + 1];
    const end = next ? next.getBoundingClientRect().top + window.scrollY : document.body.scrollHeight;
    return { top: Math.max(0, Math.round(start)), height: Math.round(end - start) };
  }, label);
  if (!box) throw new Error(`no screen labelled "${label}"`);
  await page.screenshot({
    path: file,
    fullPage: true,
    clip: { x: 0, y: box.top, width: page.viewportSize().width, height: box.height },
  });
}

async function capture(page, url, file) {
  await load(page, url);
  await page.screenshot({ path: file, fullPage: true });
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const widths = args.includes('--width') ? [Number(args[args.indexOf('--width') + 1])] : [1440, 390];
  // `--screens` compares the five article templates, which share one prototype file.
  const screensOnly = args.includes('--screens');
  const surfaces = screensOnly ? [] : only ? SURFACES.filter((s) => s.key === only) : SURFACES;
  const screens = screensOnly || !only ? SCREENS.filter((s) => !only || s.key === only) : [];

  const { chromium } = await import('@playwright/test');
  const server = await serveReference();
  const browser = await chromium.launch();
  await mkdir(OUT, { recursive: true });

  const index = [];
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      for (const surface of surfaces) {
        const protoFile = path.join(OUT, `${surface.key}-${width}-proto.png`);
        const appFile = path.join(OUT, `${surface.key}-${width}-app.png`);
        try {
          await capture(page, `http://127.0.0.1:${PROTO_PORT}/${encodeURIComponent(surface.proto)}`, protoFile);
          await capture(page, `${APP}${surface.route}`, appFile);
          index.push({ surface: surface.key, width, proto: surface.proto, route: surface.route });
          console.warn(`  ${surface.key} @ ${width}`);
        } catch (err) {
          console.error(`  ${surface.key} @ ${width} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const screen of screens) {
        const protoFile = path.join(OUT, `${screen.key}-${width}-proto.png`);
        const appFile = path.join(OUT, `${screen.key}-${width}-app.png`);
        try {
          await captureScreen(
            page,
            `http://127.0.0.1:${PROTO_PORT}/${encodeURIComponent(SCREEN_PROTO)}`,
            screen.label,
            protoFile,
          );
          await capture(page, `${APP}${screen.route}`, appFile);
          index.push({ surface: screen.key, width, proto: `${SCREEN_PROTO} · ${screen.label}`, route: screen.route });
          console.warn(`  ${screen.key} @ ${width}`);
        } catch (err) {
          console.error(`  ${screen.key} @ ${width} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ app: APP, captured: index }, null, 2));
  console.warn(`\n${index.length} pairs in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
