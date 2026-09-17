#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { COMMON_FLAGS, Counter, parseArgs, printHelp, printSummary, runAsScript, type RunSummary } from './cli';
import { safeInternalPath, normalise } from '../../lib/redirects';
import { WordPressArchive } from './archive';
import { classifyDesk, deskSignalsOf, type TermName } from './auto-desk';
import { DuplicateFinder, postFingerprint } from './duplicates';
import { WordPressSource, wpSlug, type WpPost, type WpReadSource } from './source';
import { KalElTarget } from './target';
import { deskFor, deskOf, loadCategoryMap } from './taxonomy';
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
  {
    name: 'source',
    description: 'where WordPress is read from: rest (a live site) or archive (a .sql dump)',
    type: 'string' as const,
    default: 'rest',
  },
  { name: 'dump', description: 'archive source: path to the .sql or .sql.gz dump', type: 'string' as const },
  {
    name: 'category-map',
    description: 'JSON of "wp-category-slug": "desk-slug" overrides',
    type: 'string' as const,
    default: 'data/import/category-map.json',
  },
  {
    name: 'auto-desk',
    description: 'file posts with no desk category as wp:import --auto-desk does (pass it if the import did)',
    type: 'boolean' as const,
    default: false,
  },
];

interface Entry {
  from: string;
  to: string;
  status: number;
  source: 'kalel' | 'wordpress' | 'csv';
}

/**
 * The archive's redirects that the runtime rule cannot answer.
 *
 * `/[categoria]` looks a legacy segment up as an article slug, so a post whose legacy URL
 * is its slug needs no entry. Two kinds of post do:
 *
 *  - one whose legacy URL is not its slug — the percent-escapes `slugify` removes, the
 *    headlines longer than the 120 characters it keeps;
 *  - **a copy `wp:import` skips.** Its article does not exist, so its legacy URL — `/…-2/`
 *    beside the original's `/…/` — would find nothing and answer 404. It goes to the final
 *    address of the post it copies, in one hop. A copy that shares the original's legacy
 *    URL needs nothing: the original's own rule answers it.
 *
 * Copies are the importer's (`DuplicateFinder`, the same fingerprint), so the two agree on
 * which posts are skipped — given the same desks, which is why `--auto-desk` is here too.
 */
export class ArchiveExceptions {
  private readonly finder = new DuplicateFinder();
  private readonly own = new Map<number, { from: string; to: string }>();
  private readonly covered = new Set<number>();

  /** A post the import files under `desk`. */
  add(post: WpPost, desk: string): void {
    const slug = slugify(wpSlug(post.slug));
    const to = `/${desk}/${slug}`;
    const legacy = normalise(new URL(post.link).pathname);
    this.finder.add({ id: post.id, fingerprint: postFingerprint(post), legacyPath: legacy, finalPath: to });

    // Exactly the condition the runtime rule cannot satisfy: the legacy URL is not a single
    // segment, or that segment is not the slug the article now has.
    const segments = legacy.split('/').filter(Boolean);
    if ((segments.length === 1 && segments[0] === slug) || legacy === normalise(to)) {
      this.covered.add(post.id);
      return;
    }
    this.own.set(post.id, { from: legacy, to });
  }

  result(): { entries: { from: string; to: string }[]; coveredByRule: number; duplicates: number } {
    const entries = new Map(this.own);
    const covered = new Set(this.covered);
    let duplicates = 0;
    for (const pair of this.finder.pairs()) {
      // The copy is not imported, so no rule of its own can answer for it.
      entries.delete(pair.skippedId);
      covered.delete(pair.skippedId);
      const to = pair.keptFinalPath;
      if (to === undefined || pair.legacyPath === pair.keptLegacyPath || pair.legacyPath === normalise(to)) continue;
      entries.set(pair.skippedId, { from: pair.legacyPath, to });
      duplicates += 1;
    }
    return { entries: [...entries.values()], coveredByRule: covered.size, duplicates };
  }
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
  const sourceKind = String(values.source);
  const tablePath = String(values.table);
  const outDir = String(values.out);
  const summary: RunSummary = {
    tool: 'redirects:build',
    runId: new Date().toISOString(),
    applied: apply,
    counts: new Counter([
      'kalel',
      'wordpress',
      'duplicates',
      'csv',
      'kept',
      'rejected',
      'conflicts',
      'coveredByRule',
      'noDesk',
    ]),
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

  /*
   * 2. WordPress — the permalinks the runtime rule does *not* cover.
   *
   * The archive settled two things that used to be guesses. Permalinks are
   * `/%postname%/`, so a legacy article URL is a bare slug at the root; and
   * `/[categoria]` now resolves an unknown segment against the CMS and 301s it to the
   * article's real address. Between them, 41.313 of the 41.318 articles need no table
   * entry at all — the rule is complete for them, and writing them down anyway put 5 MB
   * of JSON into the edge middleware bundle.
   *
   * What is left is the genuine exception: a post whose slug is not what the runtime
   * would look up. Five posts in this archive, all carrying a stray percent-encoded
   * character that `slugify` removes.
   *
   * The desk comes from `deskFor`, not from `post.categories[0]`. WordPress orders a
   * post's categories by term id, so the first one is usually the oldest it was ever
   * filed under: in this archive `categories[0]` is a desk for 8.459 posts and
   * `noticias` for most of the other 32.858, which would have sent four out of five
   * redirects to a section that does not exist.
   */
  if (process.env.WP_BASE_URL || sourceKind === 'archive') {
    try {
      const source: WpReadSource =
        sourceKind === 'archive'
          ? WordPressArchive.fromEnv({ ...(values.dump ? { dumpPath: String(values.dump) } : {}) })
          : WordPressSource.fromEnv({ requestsPerSecond: Number(values.rate) });

      const overrides = await loadCategoryMap(String(values['category-map']));
      const autoDesk = values['auto-desk'] === true;
      const deskById = new Map<number, string>();
      const categoryNames = new Map<number, TermName>();
      for await (const batch of source.categories()) {
        for (const term of batch) {
          const slug = slugify(term.slug || term.name);
          categoryNames.set(term.id, { slug, name: term.name });
          const desk = deskOf(slug, overrides);
          if (desk) deskById.set(term.id, desk);
        }
      }
      const tagNames = new Map<number, TermName>();
      if (autoDesk) {
        for await (const batch of source.tags()) {
          for (const term of batch) tagNames.set(term.id, { slug: slugify(term.slug || term.name), name: term.name });
        }
      }

      const exceptions = new ArchiveExceptions();
      for await (const batch of source.posts()) {
        for (const post of batch) {
          const desk =
            deskFor(
              post.categories.map((id) => deskById.get(id)).filter((s): s is string => s !== undefined),
              overrides,
            ) ?? (autoDesk ? classifyDesk(deskSignalsOf(post, categoryNames, tagNames)).desk : null);
          if (!desk) {
            summary.counts.inc('noDesk');
            continue;
          }
          exceptions.add(post, desk);
        }
      }

      const found = exceptions.result();
      for (const { from, to } of found.entries) collected.push({ from, to, status: 301, source: 'wordpress' });
      summary.counts.inc('wordpress', found.entries.length);
      summary.counts.inc('duplicates', found.duplicates);
      summary.counts.inc('coveredByRule', found.coveredByRule);
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
    // The rules themselves, not just how many. Now that the runtime rule covers the
    // bulk, what survives here is the exceptional handful, and an operator reviewing a
    // migration needs to read them rather than take a count on trust.
    JSON.stringify(
      { counts: summary.counts.toJSON(), conflicts: conflicts.slice(0, 200), rules: rows.slice(0, 200) },
      null,
      2,
    ),
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
