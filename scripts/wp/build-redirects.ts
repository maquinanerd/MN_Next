#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { COMMON_FLAGS, Counter, parseArgs, printHelp, printSummary, runAsScript, type RunSummary } from './cli';
import { safeInternalPath, normalise } from '../../lib/redirects';
import { WordPressSource } from './source';
import { KalElTarget } from './target';
import { slugify } from '@mn/content';

/**
 * Builds `data/legacy-redirects.json`.
 *
 * Three sources, merged in order of authority:
 *
 *  1. redirects already registered in Kal El (an editor's deliberate decision);
 *  2. the WordPress archive itself — every published permalink mapped to its new URL;
 *  3. `data/import/redirects.csv`, if the operator supplied one (`from,to,status`).
 *
 * The table is a build artefact rather than a runtime read because `middleware.ts` runs
 * on every request; a network call there would put the CMS in the critical path of the
 * whole site.
 *
 * Every destination goes through `safeInternalPath`. A redirect table is operator data,
 * and an operator mistake such as `//evil.example` must not become an open redirect —
 * so the validation runs here as well as at request time.
 *
 *   pnpm redirects:build --help
 *   pnpm redirects:build             # rehearsal: reports what would change
 *   pnpm redirects:build --apply     # writes data/legacy-redirects.json
 */

const FLAGS = [
  ...COMMON_FLAGS,
  {
    name: 'csv',
    description: 'extra redirects as from,to,status',
    type: 'string' as const,
    default: 'data/import/redirects.csv',
  },
  { name: 'table', description: 'output table', type: 'string' as const, default: 'data/legacy-redirects.json' },
];

interface Entry {
  from: string;
  to: string;
  status: number;
  source: 'kalel' | 'wordpress' | 'csv';
}

async function readCsv(file: string): Promise<Entry[]> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split(',').map((c) => c.trim()))
    .filter((cols) => cols.length >= 2 && cols[0] !== 'from')
    .map((cols) => ({
      from: cols[0] as string,
      to: cols[1] as string,
      status: Number(cols[2] ?? 301) || 301,
      source: 'csv' as const,
    }));
}

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2), FLAGS);
  if (values.help) {
    printHelp('redirects:build', 'Compiles the legacy redirect table from Kal El, WordPress and a CSV.', FLAGS);
    return;
  }

  const apply = values.apply === true;
  const tablePath = String(values.table);
  const outDir = String(values.out);
  const summary: RunSummary = {
    tool: 'redirects:build',
    runId: new Date().toISOString(),
    applied: apply,
    counts: new Counter(['kalel', 'wordpress', 'csv', 'kept', 'rejected', 'conflicts']),
    failures: [],
    artefacts: [],
  };

  const collected: Entry[] = [];

  // 1. Kal El — an editor said so explicitly, so it wins.
  if (process.env.KAL_EL_BASE_URL && process.env.KAL_EL_SERVICE_TOKEN && process.env.KAL_EL_SITE_ID) {
    try {
      const target = KalElTarget.fromEnv();
      const res = await target.listRedirects();
      for (const row of res.data ?? []) {
        collected.push({
          from: row.sourcePath,
          to: row.targetPath,
          status: row.kind === '302' ? 302 : 301,
          source: 'kalel',
        });
        summary.counts.inc('kalel');
      }
    } catch (err) {
      summary.failures.push({ id: 'kalel', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  // 2. WordPress — every published permalink to its new address.
  if (process.env.WP_BASE_URL) {
    try {
      const source = WordPressSource.fromEnv({ requestsPerSecond: Number(values.rate) });
      const categoriesById = new Map<number, string>();
      for await (const batch of source.categories()) {
        for (const term of batch) categoriesById.set(term.id, slugify(term.slug || term.name));
      }

      for await (const batch of source.posts()) {
        for (const post of batch) {
          const desk = categoriesById.get(post.categories[0] ?? -1);
          if (!desk) continue;
          const to = `/${desk}/${slugify(post.slug)}`;

          // The real permalink shape is still unconfirmed (docs/04, open question 1), so
          // every common form is emitted. A redirect that is never hit costs nothing; a
          // missing one costs the traffic.
          const legacy = new URL(post.link).pathname;
          const published = new Date(`${post.date_gmt}Z`);
          const yyyy = String(published.getUTCFullYear());
          const mm = String(published.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(published.getUTCDate()).padStart(2, '0');

          for (const from of [
            legacy,
            `/${yyyy}/${mm}/${slugify(post.slug)}`,
            `/${yyyy}/${mm}/${dd}/${slugify(post.slug)}`,
            `/?p=${post.id}`,
            `/slug/${slugify(post.slug)}`,
          ]) {
            if (normalise(from) === normalise(to)) continue;
            collected.push({ from, to, status: 301, source: 'wordpress' });
            summary.counts.inc('wordpress');
          }
        }
      }
    } catch (err) {
      summary.failures.push({ id: 'wordpress', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  // 3. Operator CSV.
  const csv = await readCsv(String(values.csv));
  collected.push(...csv);
  summary.counts.inc('csv', csv.length);

  // ---- validate, de-duplicate, detect conflicts -----------------------------
  const table = new Map<string, Entry>();
  const conflicts: { from: string; kept: string; dropped: string }[] = [];
  const priority = { kalel: 3, csv: 2, wordpress: 1 } as const;

  for (const entry of collected) {
    const from = normalise(entry.from);
    const to = entry.status === 410 ? '/' : safeInternalPath(entry.to);
    if (!to) {
      summary.counts.inc('rejected');
      summary.failures.push({ id: entry.from, reason: `unsafe destination: ${entry.to}` });
      continue;
    }
    // A redirect to itself is a loop, not a redirect.
    if (from === normalise(to)) {
      summary.counts.inc('rejected');
      continue;
    }

    const existing = table.get(from);
    if (!existing) {
      table.set(from, { ...entry, from, to });
      continue;
    }
    if (normalise(existing.to) === normalise(to)) continue;

    // Two sources disagree about where one URL goes. The more authoritative wins and the
    // disagreement is reported — silently picking one is how a redirect map rots.
    const winner = priority[entry.source] > priority[existing.source] ? { ...entry, from, to } : existing;
    const loser = winner === existing ? { ...entry, to } : existing;
    conflicts.push({ from, kept: `${winner.to} (${winner.source})`, dropped: `${loser.to} (${loser.source})` });
    table.set(from, winner);
    summary.counts.inc('conflicts');
  }

  // A chain (A→B, B→C) costs the reader two round trips and dilutes the signal.
  for (const [from, entry] of table) {
    const next = table.get(normalise(entry.to));
    if (next && normalise(next.to) !== from) {
      table.set(from, { ...entry, to: next.to });
    }
  }

  summary.counts.inc('kept', table.size);

  const rows = [...table.values()]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map(({ from, to, status }) => ({ from, to, status }));

  await mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'redirects-report.json');
  await writeFile(
    reportPath,
    JSON.stringify({ counts: summary.counts.toJSON(), conflicts: conflicts.slice(0, 200) }, null, 2),
    'utf8',
  );
  summary.artefacts.push(reportPath);

  if (apply) {
    await mkdir(path.dirname(tablePath), { recursive: true });
    await writeFile(tablePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    summary.artefacts.push(tablePath);
  } else {
    console.log(`[redirects:build] dry run — ${rows.length} rules would be written to ${tablePath}`);
  }

  printSummary(summary);
}

runAsScript(import.meta.url, main);
