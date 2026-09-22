#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { COMMON_FLAGS, Counter, parseArgs, printHelp, printSummary, runAsScript, type RunSummary } from './cli';
import { WordPressArchive } from './archive';
import { mappingKey } from './state';
import { MEDIA_TABLE_PATH, originalOf } from '../../lib/legacy-media';

/**
 * Builds `data/legacy-media.tsv.gz`: every WordPress upload path, mapped to the Kal El
 * media row the import made of it.
 *
 * Two inputs, both already on the operator's machine after a session:
 *
 *  - the dump, for each attachment's real path (`_wp_attached_file`, e.g.
 *    `2025/07/cena-scaled.jpg`) — the month folder is what tells two `image-1.png` apart;
 *  - the import's state file, for `wpMedia:<attachment id>` → Kal El media id.
 *
 * Exact paths, not a search by name: the library also holds 21 thousand pictures the
 * import copied from other sites under their own names, and a search would send an old URL
 * to one of them. A path absent from the table is a 404.
 *
 *   pnpm media-redirects:build --help
 *   pnpm media-redirects:build --dump C:\…\127_0_0_1.sql            # rehearsal
 *   pnpm media-redirects:build --dump C:\…\127_0_0_1.sql --apply    # writes the table
 */

const FLAGS = [
  ...COMMON_FLAGS,
  { name: 'dump', description: 'path to the WordPress .sql or .sql.gz dump', type: 'string' as const },
  {
    name: 'import-state',
    description: "the import session's state file, which maps each attachment to its Kal El id",
    type: 'string' as const,
    default: 'artifacts/migration/producao/state.json',
  },
  { name: 'table', description: 'output table', type: 'string' as const, default: MEDIA_TABLE_PATH },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2), FLAGS);
  if (values.help) {
    printHelp('media-redirects:build', 'Maps every WordPress upload path to its Kal El media id.', FLAGS);
    return;
  }

  const apply = values.apply === true;
  const summary: RunSummary = {
    tool: 'media-redirects:build',
    runId: new Date().toISOString(),
    applied: apply,
    counts: new Counter(['attachments', 'mapped', 'notImported', 'originals', 'unsafe']),
    failures: [],
    artefacts: [],
  };

  const state = JSON.parse(await readFile(String(values['import-state']), 'utf8')) as {
    mappings?: Record<string, string>;
  };
  const mappings = state.mappings ?? {};

  const archive = WordPressArchive.fromEnv({ ...(values.dump ? { dumpPath: String(values.dump) } : {}) });
  const table = new Map<string, string>();
  const originals: [string, string][] = [];

  for await (const batch of archive.media()) {
    for (const asset of batch) {
      summary.counts.inc('attachments');
      const id = mappings[mappingKey('media', asset.id)];
      if (!id || !UUID.test(id)) {
        summary.counts.inc('notImported');
        continue;
      }
      const file = asset.media_details?.file ?? '';
      // A path is a key only if it is plain: no traversal, no control characters.
      if (!file || file.includes('..') || file.startsWith('/') || /[\t\n\r\0]/.test(file)) {
        summary.counts.inc('unsafe');
        continue;
      }
      table.set(file, id);
      summary.counts.inc('mapped');
      // The sizes WordPress cut are named after the original, not after its `-scaled` copy.
      const original = originalOf(file);
      if (original !== file) originals.push([original, id]);
    }
  }
  // An original's name is only claimed when no attachment of its own already holds it.
  for (const [path, id] of originals) {
    if (!table.has(path)) {
      table.set(path, id);
      summary.counts.inc('originals');
    }
  }

  const lines = [...table.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([p, id]) => `${p}\t${id}`);
  const body = gzipSync(Buffer.from(`${lines.join('\n')}\n`, 'utf8'), { level: 9 });
  if (apply) {
    await writeFile(String(values.table), body);
    summary.artefacts.push(String(values.table));
  }
  console.log(JSON.stringify({ entries: lines.length, gzipBytes: body.length }));
  printSummary(summary);
}

runAsScript(import.meta.url, main);
