import 'server-only';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

import { ContentError } from '../errors';
import { redact, serverEnv } from '../env';
import { kalelEnvelope, kalelErrorSchema } from './dto';

/**
 * The only place that speaks HTTP to Kal El.
 *
 * Responsibilities, and deliberately nothing else:
 *  - attach the service credential (server-side, never serialised into a payload or log);
 *  - bound every call with an explicit timeout;
 *  - retry GET exactly once, with jitter, and never retry a write;
 *  - attach Next cache tags and revalidate windows;
 *  - validate the envelope and hand the mapper a typed value or a ContentError.
 */

export type FetchLike = typeof fetch;

export interface KalElTransportOptions {
  baseUrl: string;
  token: string;
  siteId: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  onLog?: (line: string, meta: Record<string, unknown>) => void;
}

export interface ReadRequest {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  tags?: string[];
  revalidate?: number | false;
  /** `no-store` for search and preview; everything else is tag-cached. */
  noStore?: boolean;
  correlationId?: string;
}

export interface WriteRequest {
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Required for POST so a retry at the edge cannot create a second record. */
  idempotencyKey?: string;
  ifMatch?: string;
  correlationId?: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

function jitter(baseMs: number): number {
  return Math.round(baseMs * (0.5 + Math.random()));
}

export class KalElTransport {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly onLog: (line: string, meta: Record<string, unknown>) => void;
  readonly siteId: string;

  constructor(opts: KalElTransportOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.siteId = opts.siteId;
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.onLog = opts.onLog ?? (() => {});
  }

  static fromEnv(overrides: Partial<KalElTransportOptions> = {}): KalElTransport {
    const env = serverEnv();
    if (!env.KAL_EL_BASE_URL || !env.KAL_EL_SERVICE_TOKEN || !env.KAL_EL_SITE_ID) {
      throw new ContentError('unavailable', 'Kal El is not configured (base url, site id or service token missing)');
    }
    return new KalElTransport({
      baseUrl: env.KAL_EL_BASE_URL,
      token: env.KAL_EL_SERVICE_TOKEN,
      siteId: env.KAL_EL_SITE_ID,
      timeoutMs: env.KAL_EL_TIMEOUT_MS,
      ...overrides,
    });
  }

  sitePath(suffix: string): string {
    return `/v1/sites/${this.siteId}${suffix}`;
  }

  private url(path: string, query?: ReadRequest['query']): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return `${this.baseUrl}${path}${suffix}`;
  }

  /** GET with Next tag caching, one bounded retry, and envelope validation. */
  async read<T extends z.ZodTypeAny>(schema: T, req: ReadRequest): Promise<z.infer<T>> {
    const correlationId = req.correlationId ?? randomUUID();
    const url = this.url(req.path, req.query);
    const envelope = kalelEnvelope(schema);

    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      const isLastAttempt = attempt === 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${this.token}`,
            accept: 'application/json',
            'x-correlation-id': correlationId,
          },
          signal: controller.signal,
          // `no-store` for search/preview; otherwise a tagged, time-bounded entry.
          ...(req.noStore
            ? { cache: 'no-store' as const }
            : {
                next: {
                  tags: req.tags ?? [],
                  ...(req.revalidate === undefined ? {} : { revalidate: req.revalidate }),
                },
              }),
        });

        if (res.status === 404) throw ContentError.notFound(req.path, correlationId);
        if (res.status === 401 || res.status === 403) {
          throw new ContentError('unauthorized', 'Kal El rejected the service credential', {
            correlationId,
            status: res.status,
          });
        }
        if (!res.ok) {
          const detail = await this.errorDetail(res);
          const err = ContentError.unavailable(`Kal El GET ${req.path} failed with ${res.status}`, {
            correlationId,
            status: res.status,
          });
          this.onLog('kalel.read.error', { correlationId, path: req.path, status: res.status, detail });
          if (RETRYABLE.has(res.status) && !isLastAttempt) {
            lastError = err;
            clearTimeout(timer);
            await new Promise((r) => setTimeout(r, jitter(200)));
            continue;
          }
          throw err;
        }

        const json: unknown = await res.json();
        const parsed = envelope.safeParse(json);
        if (!parsed.success) {
          const detail = parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          this.onLog('kalel.contract.violation', { correlationId, path: req.path, detail });
          throw ContentError.contract(`Kal El response for ${req.path} does not satisfy the agreed schema`, {
            correlationId,
            detail,
          });
        }
        return parsed.data.data as z.infer<T>;
      } catch (err) {
        clearTimeout(timer);
        // Editorial 404s, credential rejections and contract violations are terminal:
        // repeating them only doubles the latency of a failure that will not change.
        if (err instanceof ContentError) throw err;
        lastError = err;
        const aborted = err instanceof Error && err.name === 'AbortError';
        if (!isLastAttempt) {
          await new Promise((r) => setTimeout(r, jitter(200)));
          continue;
        }
        this.onLog('kalel.read.transport-error', {
          correlationId,
          path: req.path,
          message: redact(err instanceof Error ? err.message : String(err)),
        });
        throw ContentError.unavailable(
          aborted ? `Kal El GET ${req.path} timed out after ${this.timeoutMs}ms` : `Kal El GET ${req.path} failed`,
          { correlationId, cause: err },
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw ContentError.unavailable(`Kal El GET ${req.path} failed`, { correlationId, cause: lastError });
  }

  /** Writes are never retried blindly; an idempotency key is required for POST. */
  async write<T extends z.ZodTypeAny>(schema: T | null, req: WriteRequest): Promise<z.infer<T> | null> {
    const correlationId = req.correlationId ?? randomUUID();
    if (req.method === 'POST' && !req.idempotencyKey) {
      throw new ContentError('unsupported', 'A POST to Kal El requires an idempotency key');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.url(req.path), {
        method: req.method,
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-correlation-id': correlationId,
          ...(req.idempotencyKey ? { 'idempotency-key': req.idempotencyKey } : {}),
          ...(req.ifMatch ? { 'if-match': req.ifMatch } : {}),
        },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        cache: 'no-store',
        signal: controller.signal,
      });

      if (res.status === 204) return null;
      if (res.status === 404) throw ContentError.notFound(req.path, correlationId);
      if (res.status === 401 || res.status === 403) {
        throw new ContentError('unauthorized', 'Kal El rejected the service credential', {
          correlationId,
          status: res.status,
        });
      }
      if (!res.ok) {
        const detail = await this.errorDetail(res);
        throw ContentError.unavailable(`Kal El ${req.method} ${req.path} failed with ${res.status}`, {
          correlationId,
          status: res.status,
          cause: detail,
        });
      }
      if (!schema) return null;
      const json: unknown = await res.json();
      const parsed = kalelEnvelope(schema).safeParse(json);
      if (!parsed.success) {
        throw ContentError.contract(`Kal El ${req.method} ${req.path} returned an unexpected payload`, {
          correlationId,
        });
      }
      return parsed.data.data as z.infer<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Raw byte fetch for the media proxy. Returns the upstream response so the route
   * handler can stream it with the CMS-declared content type.
   */
  async readBytes(path: string, signal?: AbortSignal): Promise<Response> {
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.token}` },
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
  }

  /** Never returns raw upstream text into an exception message unredacted. */
  private async errorDetail(res: Response): Promise<string> {
    try {
      const text = await res.text();
      const json: unknown = text ? JSON.parse(text) : undefined;
      const parsed = kalelErrorSchema.safeParse(json);
      if (parsed.success) return `${parsed.data.error.code}: ${parsed.data.error.message}`;
      return redact(text.slice(0, 300));
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}
