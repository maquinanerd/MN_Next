import 'server-only';
import { createHash } from 'node:crypto';

import { REVALIDATE, TAG } from '../cache-tags';
import type { CinerieRef, CinerieTitle } from '../domain/types';
import { redact, serverEnv } from '../env';
import { ContentError } from '../errors';
import { withDeadline } from '../kalel/transport';
import { logger } from '../logger';
import { cinerieContextResponseSchema, mapCinerieTitles } from './map';

/**
 * The fichas of an article's works, from the Cinerie Context Service
 * (`POST {CINERIE_INTERNAL_URL}/api/internal/editorial-context`, server to server).
 *
 * Optional by construction (docs/02, "Cinerie e módulos opcionais retornam null"): without
 * `CINERIE_INTERNAL_URL` and `CINERIE_SERVICE_TOKEN` there is no call and no ficha, and any
 * failure is thrown for the caller's `optional()` to log and drop — the article stays 200.
 *
 * One hour in the data cache under `cinerie:titles` (REVALIDATE.cinerie). The request body
 * is deterministic for a given article, so the cache key is too. The token never leaves
 * this module and is redacted from anything logged.
 */

/** Short: the ficha is never worth holding an article render for. */
const CINERIE_TIMEOUT_MS = 3_500;

export interface CinerieDeps {
  fetchImpl?: typeof fetch;
  /** Overrides the configured service, for tests. */
  service?: { baseUrl: string; token: string } | null;
}

let warned = false;

/**
 * The service, from the two variables — or null, and the ficha is off.
 *
 * Validated here and not in the env schema, so a typo costs the ficha and not the site.
 * Off, with one warning per process: only one of the two set; a URL that is not absolute;
 * plain `http` outside development (the token would travel in clear text).
 */
export function cinerieServiceFrom(
  raw: { url?: string | undefined; token?: string | undefined },
  appEnv: string,
): { baseUrl: string; token: string } | null {
  const url = (raw.url ?? '').trim().replace(/\/+$/, '');
  const token = (raw.token ?? '').trim();
  if (!url && !token) return null;
  const problem = (() => {
    if (!url || !token) return 'only one of CINERIE_INTERNAL_URL / CINERIE_SERVICE_TOKEN is set';
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'CINERIE_INTERNAL_URL is not an absolute URL';
    }
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'https:') return null;
    if (parsed.protocol === 'http:' && local && appEnv !== 'production' && appEnv !== 'staging') return null;
    return 'CINERIE_INTERNAL_URL must be https';
  })();
  if (problem) {
    if (!warned) logger.warn('cinerie.config.ignored', { reason: problem });
    warned = true;
    return null;
  }
  return { baseUrl: url, token };
}

function configuredService(): { baseUrl: string; token: string } | null {
  let env: ReturnType<typeof serverEnv>;
  try {
    env = serverEnv();
  } catch {
    // An environment that cannot serve readers (fixture mode, a test) has no ficha either.
    return null;
  }
  return cinerieServiceFrom({ url: env.CINERIE_INTERNAL_URL, token: env.CINERIE_SERVICE_TOKEN }, env.appEnv);
}

export async function fetchCinerieTitles(refs: CinerieRef[], deps: CinerieDeps = {}): Promise<CinerieTitle[]> {
  if (refs.length === 0) return [];
  const service = deps.service === undefined ? configuredService() : deps.service;
  if (!service) return [];

  const fetchImpl = deps.fetchImpl ?? fetch;
  const items = refs.map((ref) =>
    ref.entityId ? { kind: ref.kind, entityId: ref.entityId } : { kind: ref.kind, slug: ref.slug },
  );
  const body = JSON.stringify({ language: 'pt-BR', items });
  // Derived from the body, never random: Next keys the data cache on the request
  // headers too (`incremental-cache` `generateCacheKey` drops only the W3C trace
  // headers), and a fresh id per call would make every render a cache miss.
  const correlationId = `cinerie-${createHash('sha256').update(body).digest('hex').slice(0, 16)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CINERIE_TIMEOUT_MS);
  try {
    const res = await withDeadline(
      fetchImpl(`${service.baseUrl}/api/internal/editorial-context`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${service.token}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-correlation-id': correlationId,
        },
        body,
        signal: controller.signal,
        next: { tags: [TAG.cinerie], revalidate: REVALIDATE.cinerie },
      }),
      controller.signal,
    );
    if (!res.ok) {
      logger.warn('cinerie.context.error', { correlationId, status: res.status });
      throw ContentError.unavailable(`Cinerie context answered ${res.status}`, { correlationId, status: res.status });
    }
    const answer: unknown = await withDeadline(res.json(), controller.signal);
    const parsed = cinerieContextResponseSchema.safeParse(answer);
    if (!parsed.success) {
      const detail = redact(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      logger.error('cinerie.contract.violation', { correlationId, detail });
      throw ContentError.contract('Cinerie context outside the contract', { correlationId, detail });
    }
    return mapCinerieTitles(parsed.data, refs);
  } finally {
    clearTimeout(timer);
  }
}
