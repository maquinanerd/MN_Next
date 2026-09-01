#!/usr/bin/env node
/**
 * Generates the placeholder imagery the fixture corpus points at.
 *
 * Neutral gradients drawn locally with `sharp` - no third-party assets. The prototype's
 * `uploads/` folder is reference material for composition only and is never a runtime
 * dependency (docs/10), so nothing from it is copied here.
 *
 * Outputs are committed so CI can render the visual audit without running sharp.
 *
 *   pnpm fixtures:media
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const OUT = path.resolve('public/fixtures');

/** Deterministic hue per name, so a regenerated fixture set looks identical. */
function hue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function svg(name, width, height) {
  const h = hue(name);
  const h2 = (h + 42) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${h} 34% 22%)"/>
      <stop offset="100%" stop-color="hsl(${h2} 30% 12%)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect x="${width * 0.06}" y="${height * 0.72}" width="${width * 0.26}" height="${Math.max(4, height * 0.012)}" fill="hsl(${h} 60% 62%)"/>
  <text x="${width * 0.06}" y="${height * 0.66}" font-family="sans-serif" font-size="${Math.round(height * 0.07)}" font-weight="700" fill="hsl(0 0% 92%)" opacity="0.85">${name}</text>
</svg>`;
}

const TARGETS = [
  ...Array.from({ length: 18 }, (_, i) => [`cover-${String(i + 1).padStart(2, '0')}`, 1600, 900]),
  ...Array.from({ length: 5 }, (_, i) => [`still-${String(i + 1).padStart(2, '0')}`, 1600, 900]),
  ...Array.from({ length: 4 }, (_, i) => [`poster-${String(i + 1).padStart(2, '0')}`, 800, 1200]),
  ...Array.from({ length: 2 }, (_, i) => [`product-${String(i + 1).padStart(2, '0')}`, 1200, 1200]),
  ['og-default', 1200, 630],
];

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.error('sharp is not available; run `pnpm install` first.');
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  for (const [name, width, height] of TARGETS) {
    const buffer = await sharp(Buffer.from(svg(name, width, height)))
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    await writeFile(path.join(OUT, `${name}.jpg`), buffer);
  }

  // The social fallback lives with the brand assets rather than with the fixtures.
  const og = await sharp(Buffer.from(svg('Máquina Nerd', 1200, 630)))
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await mkdir(path.resolve('public/brand'), { recursive: true });
  await writeFile(path.resolve('public/brand/og-default.jpg'), og);

  console.log(`Wrote ${TARGETS.length} fixture images to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
