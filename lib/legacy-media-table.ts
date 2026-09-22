import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { MEDIA_TABLE_PATH } from './legacy-media';
import { logger } from './logger';

/**
 * `data/legacy-media.tsv.gz`, read once per process and kept in memory: upload path → Kal
 * El media id, one tab-separated line each. Traced into the standalone build by
 * `outputFileTracingIncludes` (next.config.ts). Absent or unreadable, the table is empty and
 * every old image URL is a 404 — the state before it existed, never a crash.
 *
 * `LEGACY_MEDIA_TABLE` points elsewhere — a plain `.tsv` is read as it is — so the test
 * suites run against a table of their own corpus instead of production ids.
 */

let table: Map<string, string> | null = null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseMediaTable(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    const tab = line.lastIndexOf('\t');
    if (tab <= 0) continue;
    const id = line.slice(tab + 1);
    if (UUID.test(id)) map.set(line.slice(0, tab), id);
  }
  return map;
}

export function mediaTable(): Map<string, string> {
  if (table) return table;
  try {
    const file = path.resolve(process.cwd(), process.env.LEGACY_MEDIA_TABLE ?? MEDIA_TABLE_PATH);
    const bytes = readFileSync(file);
    table = parseMediaTable((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
  } catch (err) {
    logger.warn('legacy-media.table-missing', { error: String(err) });
    table = new Map();
  }
  return table;
}

/** The Kal El media id of the first key the table holds, or null. */
export function mediaIdFor(keys: readonly string[]): string | null {
  const map = mediaTable();
  for (const key of keys) {
    const id = map.get(key);
    if (id) return id;
  }
  return null;
}
