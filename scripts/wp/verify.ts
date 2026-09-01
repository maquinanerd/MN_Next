#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { COMMON_FLAGS, Counter, parseArgs, printHelp, printSummary, runAsScript, type RunSummary } from './cli';

/**
 * Checks a list of legacy URLs against the running site.
 *
 * This is the launch gate the migration plan calls for: **zero accidental 404 and zero
 * loop** across the highest-traffic URLs. It reads a plain list — one URL or path per
 * line — so a Search Console or Analytics export can be dropped in with no massaging.
 *
 * Redirects are followed manually, one hop at a time, because the questions that matter
 * are "how many hops" and "did it end where it should", and `redirect: follow` hides both.
 *
 *   pnpm urls:verify --help
 *   pnpm urls:verify --base http://localhost:3000 --urls data/import/top-urls.txt
 *
 * Exits non-zero when any URL ends in a 404, a loop, or more than `--max-hops` hops, so
 * CI and the cutover runbook can gate on it.
 */

const FLAGS = [
  ...COMMON_FLAGS,
  { name: 'base', description: 'site to check', type: 'string' as const, default: 'http://localhost:3000' },
  {
    name: 'urls',
    description: 'file with one URL or path per line',
    type: 'string' as const,
    default: 'data/import/top-urls.txt',
  },
  {
    name: 'max-hops',
    description: 'redirect hops allowed before it counts as a failure',
    type: 'number' as const,
    default: 3,
  },
  { name: 'concurrency', description: 'requests in flight', type: 'number' as const, default: 6 },
];

interface Result {
  url: string;
  finalStatus: number;
  finalUrl: string;
  hops: number;
  verdict: 'ok' | 'not-found' | 'loop' | 'too-many-hops' | 'gone' | 'error';
}

async function follow(base: string, input: string, maxHops: number): Promise<Result> {
  const start = input.startsWith('http') ? new URL(input).pathname + new URL(input).search : input;
  let current = new URL(start, base).toString();
  const seen = new Set<string>();
  let hops = 0;

  for (;;) {
    if (seen.has(current)) return { url: input, finalStatus: 508, finalUrl: current, hops, verdict: 'loop' };
    seen.add(current);

    let res: Response;
    try {
      res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    } catch {
      return { url: input, finalStatus: 0, finalUrl: current, hops, verdict: 'error' };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return { url: input, finalStatus: res.status, finalUrl: current, hops, verdict: 'error' };
      hops += 1;
      if (hops > maxHops) {
        return { url: input, finalStatus: res.status, finalUrl: current, hops, verdict: 'too-many-hops' };
      }
      current = new URL(location, current).toString();
      continue;
    }

    if (res.status === 410) return { url: input, finalStatus: 410, finalUrl: current, hops, verdict: 'gone' };
    if (res.status === 404) return { url: input, finalStatus: 404, finalUrl: current, hops, verdict: 'not-found' };
    if (res.status >= 400) return { url: input, finalStatus: res.status, finalUrl: current, hops, verdict: 'error' };
    return { url: input, finalStatus: res.status, finalUrl: current, hops, verdict: 'ok' };
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2), FLAGS);
  if (values.help) {
    printHelp('urls:verify', 'Verifies legacy URLs resolve without a 404 or a loop.', FLAGS);
    return;
  }

  const base = String(values.base).replace(/\/+$/, '');
  const listPath = String(values.urls);
  const maxHops = Number(values['max-hops']);
  const concurrency = Math.max(1, Number(values.concurrency));
  const outDir = String(values.out);

  let list: string[];
  try {
    list = (await readFile(listPath, 'utf8'))
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));
  } catch {
    // Saying "no sample available" is the honest outcome; inventing URLs would produce a
    // green result that proves nothing.
    console.error(
      JSON.stringify({
        error: `no URL list at ${listPath}`,
        hint: 'export the highest-traffic URLs from Search Console or Analytics, one per line',
      }),
    );
    process.exit(2);
  }

  const results: Result[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= list.length) return;
        results.push(await follow(base, list[index] as string, maxHops));
      }
    }),
  );

  const byVerdict = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const failures = results.filter((r) => r.verdict !== 'ok' && r.verdict !== 'gone');

  await mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'url-verification.json');
  await writeFile(
    reportPath,
    JSON.stringify({ base, checked: results.length, byVerdict, failures: failures.slice(0, 500) }, null, 2),
    'utf8',
  );

  const summary: RunSummary = {
    tool: 'urls:verify',
    runId: new Date().toISOString(),
    applied: false,
    counts: (() => {
      const c = new Counter(['checked']);
      c.inc('checked', results.length);
      for (const [verdict, n] of Object.entries(byVerdict)) c.inc(verdict, n);
      return c;
    })(),
    failures: failures
      .slice(0, 50)
      .map((f) => ({ id: f.url, reason: `${f.verdict} (${f.finalStatus}) -> ${f.finalUrl}` })),
    artefacts: [reportPath],
  };
  printSummary(summary);

  if (failures.length > 0) process.exit(1);
}

runAsScript(import.meta.url, main);
