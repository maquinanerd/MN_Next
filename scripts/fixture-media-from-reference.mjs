#!/usr/bin/env node
/**
 * Replaces the fixture imagery with the photographs the approved prototypes actually use.
 *
 * The gradients `pnpm fixtures:media` draws are fine as placeholders and wrong as a
 * presentation: a front page whose every cover is a flat two-tone rectangle reads as a
 * wireframe, and no amount of correct spacing rescues it. The seven `*.dc.html` files
 * reference real photographs, all of them uploads on the operator's own WordPress, and
 * this pulls those in so the fixture build shows the design as approved.
 *
 *   pnpm fixtures:media:reference     # download and resize into public/fixtures
 *   pnpm fixtures:media               # go back to generated gradients
 *
 * Two constraints it keeps:
 *
 *  - **One host, declared here.** The URLs come out of the prototypes, which are input
 *    files, so the host is pinned rather than trusted from the parsed markup. Anything
 *    else is refused, which is the same rule the importer follows for the same reason.
 *  - **Bounded.** Each image is resized to 1600px and re-encoded, so the repository
 *    gains a few megabytes rather than a few dozen.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REFERENCE = path.resolve('.migration-reference/claude-design');
const OUT = path.resolve('public/fixtures');
const ALLOWED_HOST = 'www.maquinanerd.com.br';
const MAX_BYTES = 12 * 1024 * 1024;

/** Every image URL the prototypes point at, in a stable order. */
async function referencedImages() {
  const files = (await readdir(REFERENCE)).filter((f) => f.endsWith('.dc.html')).sort();
  const urls = new Set();
  for (const file of files) {
    const html = await readFile(path.join(REFERENCE, file), 'utf8');
    for (const match of html.matchAll(/https:\/\/[^"'\s)]+\/wp-content\/uploads\/[^"'\s)]+/g)) {
      urls.add(match[0]);
    }
  }
  return [...urls].sort();
}

async function download(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST) {
    throw new Error(`refusing ${parsed.hostname}: only ${ALLOWED_HOST} is allowed here`);
  }
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error(`${url} is ${buffer.byteLength} bytes`);
  return buffer;
}

/** The shapes the fixture corpus asks for, and how many of each. */
const TARGETS = [
  { prefix: 'cover', count: 18, width: 1600, height: 900 },
  { prefix: 'still', count: 5, width: 1600, height: 900 },
  { prefix: 'poster', count: 4, width: 800, height: 1200 },
  { prefix: 'product', count: 2, width: 1200, height: 1200 },
];

async function main() {
  const { default: sharp } = await import('sharp');
  const urls = await referencedImages();
  if (urls.length === 0) {
    console.error('No referenced images found. Run Inspect-Inputs.ps1 -ExtractReferences first.');
    process.exit(1);
  }
  console.log(`${urls.length} photographs referenced by the prototypes`);

  const sources = [];
  for (const url of urls) {
    try {
      sources.push({ url, bytes: await download(url) });
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  skipped ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log('');
  if (sources.length === 0) {
    console.error('Nothing could be downloaded; the fixture imagery is unchanged.');
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  let written = 0;
  let i = 0;
  for (const { prefix, count, width, height } of TARGETS) {
    for (let n = 1; n <= count; n += 1) {
      // Cycled deliberately: there are fewer photographs than fixture slots, and a
      // repeated photograph is a truer preview than a gradient beside a photograph.
      const source = sources[i % sources.length];
      i += 1;
      const name = `${prefix}-${String(n).padStart(2, '0')}.jpg`;
      const buffer = await sharp(source.bytes)
        .resize({ width, height, fit: 'cover', position: 'attention' })
        .jpeg({ quality: 76, mozjpeg: true })
        .toBuffer();
      await writeFile(path.join(OUT, name), buffer);
      written += 1;
    }
  }

  const og = await sharp(sources[0].bytes)
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(OUT, 'og-default.jpg'), og);

  console.log(`Wrote ${written + 1} images to ${OUT} from ${sources.length} sources.`);
  console.log('Run `pnpm fixtures:media` to go back to generated gradients.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
