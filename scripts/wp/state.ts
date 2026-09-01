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
    failures: [],
  };
}

export async function loadState(file: string, now: string, resume: boolean): Promise<RunState> {
  if (!resume) return emptyState(now);
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw) as RunState;
  } catch {
    // A missing checkpoint on `--resume` starts a fresh run rather than failing: the
    // pipeline is idempotent, so re-reading from the beginning is always safe.
    return emptyState(now);
  }
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
