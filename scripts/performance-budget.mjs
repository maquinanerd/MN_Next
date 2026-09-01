#!/usr/bin/env node
/**
 * Performance budget gate.
 *
 * Reads what `next build` actually produced and fails when the first-load JavaScript
 * exceeds the budget in docs/08. This is deliberately *not* Lighthouse: Lighthouse
 * measures a running site on a particular machine and is far too noisy to gate a merge
 * on, whereas bundle size is deterministic and is the number that regresses silently.
 *
 * Lighthouse still belongs in the pre-launch checklist against staging, where a real
 * LCP can be measured; it is listed there rather than pretended to here.
 *
 *   pnpm test:performance
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

/** Budgets from docs/08-performance.md, in kilobytes, compressed. */
const BUDGETS = {
  firstLoadJs: 120,
  css: 25,
};

/** Rough gzip ratio. The build reports compressed sizes; this is for raw file sums. */
const COMPRESSION = 0.32;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function main() {
  const buildDir = '.next';
  try {
    await stat(buildDir);
  } catch {
    console.error(JSON.stringify({ error: 'no .next directory; run `pnpm build` first' }));
    process.exit(2);
  }

  const manifestPath = path.join(buildDir, 'app-build-manifest.json');
  let sharedChunks = [];
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    // Every page carries these, so they are the floor of the first load.
    const pages = Object.values(manifest.pages ?? {});
    if (pages.length > 0) {
      sharedChunks = pages.reduce((acc, files) => acc.filter((f) => files.includes(f)), [...pages[0]]);
    }
  } catch {
    console.error(JSON.stringify({ error: `could not read ${manifestPath}` }));
    process.exit(2);
  }

  let sharedBytes = 0;
  for (const chunk of sharedChunks.filter((f) => f.endsWith('.js'))) {
    try {
      sharedBytes += (await stat(path.join(buildDir, chunk))).size;
    } catch {
      /* a chunk listed but not emitted is not a budget problem */
    }
  }

  const cssFiles = (await walk(path.join(buildDir, 'static'))).filter((f) => f.endsWith('.css'));
  let cssBytes = 0;
  for (const file of cssFiles) cssBytes += (await stat(file)).size;

  const firstLoadKb = Math.round((sharedBytes * COMPRESSION) / 1024);
  const cssKb = Math.round((cssBytes * COMPRESSION) / 1024);

  const results = [
    { metric: 'first-load JS (shared, compressed)', value: firstLoadKb, budget: BUDGETS.firstLoadJs },
    { metric: 'CSS (compressed)', value: cssKb, budget: BUDGETS.css },
  ];

  for (const r of results) {
    const verdict = r.value <= r.budget ? 'ok' : 'OVER BUDGET';
    console.log(`${verdict.padEnd(12)} ${String(r.value).padStart(4)} KB / ${r.budget} KB  ${r.metric}`);
  }

  const over = results.filter((r) => r.value > r.budget);
  console.log(
    JSON.stringify({
      summary: {
        tool: 'performance-budget',
        results,
        note: 'Advertising is measured separately and is outside this budget (docs/08).',
      },
    }),
  );
  if (over.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
