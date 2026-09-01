import 'server-only';
import { notFound } from 'next/navigation';
import type { ContentRepository } from '@mn/content';
import { ContentError, isContentError } from '@mn/content';
import { contentRepository } from '@mn/content/provider';

import { logger } from './logger';

/**
 * Server-side content access for route handlers and pages.
 *
 * The error policy lives here so it is identical on every route:
 *
 *   not_found            -> `notFound()`, an editorial 404
 *   unavailable/contract -> re-thrown, caught by the segment `error.tsx`, logged with a
 *                           correlation id, and answered as a degraded page. Never a
 *                           blank 200, and never a stack trace on the wire.
 *
 * Optional modules use `optional()` instead, which swallows dependency failures and
 * returns null so the page around them still renders.
 */

export function repo(): ContentRepository {
  return contentRepository();
}

export async function required<T>(promise: Promise<T | null>, what: string): Promise<T> {
  const value = await promise.catch((err: unknown) => {
    if (isContentError(err) && err.kind === 'not_found') return null;
    throw err;
  });
  if (value === null || value === undefined) {
    logger.info('content.not-found', { what });
    notFound();
  }
  return value;
}

/**
 * Optional module: any dependency failure degrades to `null`.
 *
 * The failure is logged with its correlation id so an outage is still visible in
 * operations, but it never reaches the reader as an error box.
 */
export async function optional<T>(promise: Promise<T>, label: string): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (isContentError(err)) {
      logger.warn('content.optional-degraded', {
        label,
        kind: err.kind,
        correlationId: err.correlationId ?? null,
      });
    } else {
      logger.warn('content.optional-degraded', { label, kind: 'unknown' });
    }
    return null;
  }
}

/** Page numbers arrive from a URL segment; anything else is a 404, not a 500. */
export function parsePage(raw: string | undefined): number {
  if (raw === undefined) return 1;
  if (!/^[1-9][0-9]{0,3}$/.test(raw)) notFound();
  return Number(raw);
}

export { ContentError };
