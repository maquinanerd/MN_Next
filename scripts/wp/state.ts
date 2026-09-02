import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Migration run state.
 *
 * This file is what makes the pipeline resumable and, more importantly, *idempotent*:
 * `mappings` records every source id that has already produced a Kal El record, so a
 * second run updates instead of duplicating. It lives under `artifacts/` and is never
 * committed - it can name real content ids.
 */

export interface RunState {
  runId: string;
  source: 'wordpress';
  startedAt: string;
  updatedAt: string;
  cursor: number;
  counts: { read: number; created: number; updated: number; skipped: number; failed: number };
  /** `wpPostId:123` -> Kal El uuid, `wpMedia:45` -> Kal El media uuid, and so on. */
  mappings: Record<string, string>;
  /**
   * WordPress media ids whose file uploaded but whose metadata PATCH did not land.
   *
   * Without this the loss is permanent: the mapping is recorded, so the next run reuses
   * the asset and never revisits it, and the alt text stays empty forever. Alt text is
   * an accessibility requirement, not a detail, so a transient 5xx on the second call
   * has to survive into the next run as work still owed.
   */
  pendingMediaMeta: number[];
  /**
   * The article version this importer last wrote, per source item.
   *
   * `If-Match` alone only protects the moment between reading a version and writing it,
   * which is a few milliseconds — it says nothing about an editor who improved the
   * article last week. Remembering what we wrote is what turns "left untouched" from a
   * claim in the runbook into behaviour: if the CMS has moved on from our number, the
   * change is not ours to overwrite.
   */
  articleVersions: Record<string, number>;
  failures: { id: string; reason: string }[];
}

export function emptyState(now: string, runId = randomUUID()): RunState {
  return {
    runId,
    source: 'wordpress',
    startedAt: now,
    updatedAt: now,
    cursor: 0,
    counts: { read: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
    mappings: {},
    pendingMediaMeta: [],
    articleVersions: {},
    failures: [],
  };
}

/**
 * Loads the checkpoint.
 *
 * `--resume` decides whether to continue from the saved *position*. It does not decide
 * whether to remember what this importer has already written: `articleVersions` and
 * `pendingMediaMeta` are records of ownership, and discarding them turns a run without
 * `--resume` into one that overwrites an article an editor has since improved. So the
 * file is always read when it exists, and only the cursor is conditional.
 */
export async function loadState(file: string, now: string, resume: boolean): Promise<RunState> {
  let parsed: RunState | null = null;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8')) as RunState;
  } catch {
    // A missing or unreadable checkpoint starts a fresh run rather than failing: the
    // pipeline is idempotent, so re-reading from the beginning is always safe.
    parsed = null;
  }
  if (!parsed) return emptyState(now);

  const carried = {
    // A checkpoint written before these fields existed is still a valid checkpoint.
    pendingMediaMeta: parsed.pendingMediaMeta ?? [],
    articleVersions: parsed.articleVersions ?? {},
    mappings: parsed.mappings ?? {},
  };
  if (resume) return { ...parsed, ...carried };
  return { ...emptyState(now), runId: parsed.runId, ...carried };
}

export async function saveState(file: string, state: RunState): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

export function mappingKey(
  kind: 'post' | 'media' | 'category' | 'tag' | 'author' | 'redirect',
  id: string | number,
): string {
  return `wp${kind[0]?.toUpperCase()}${kind.slice(1)}:${id}`;
}

/**
 * Idempotency key for a Kal El write.
 *
 * Derived from the source entity, not from the request body, so a retry of the same
 * import step collides deliberately while a genuinely new import of a changed article
 * does not.
 */
export function idempotencyKey(kind: string, sourceId: string | number, runScope = 'import'): string {
  return `wp.${kind}.${sourceId}.${runScope}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 128);
}
