import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';

import { ContentError } from '../errors';
import { redact, serverEnv } from '../env';
import { logger } from '../logger';
import { kalelEnvelope, kalelErrorSchema } from './dto';

/**
 * The only place that speaks HTTP to Kal El.
 *
 * Responsibilities, and deliberately nothing else:
 *  - attach the service credential (server-side, never serialised into a payload or log);
 *  - bound every call with an explicit timeout;
 *  - retry GET exactly once, with jitter — or after Kal El's own `retry-after` on a 429,
 *    when that wait is short — and never retry a write;
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
  /**
   * `false` for one attempt only — no retry, no wait on `retry-after`: for a probe that
   * must answer inside its own deadline rather than a reader's.
   */
  retry?: boolean;
  /**
   * Honoured by `noStore` reads only. A cached read's id is derived from its URL
   * (`readCorrelationId`): any other value would split Next's data cache.
   */
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

/** 429 is not here: a rate limit has its own rule, below. */
const RETRYABLE = new Set([408, 425, 500, 502, 503, 504]);

/**
 * The longest one read waits on Kal El's `retry-after` before its single retry.
 *
 * Kal El allows 600 requests a minute per service token and answers a 429 with the
 * seconds left in the window. A wait that short is cheaper than failing the render. A
 * longer one is not worth holding a reader for, and retrying before the stated time only
 * spends another request of a quota that is already gone — so past this bound the read
 * gives up at once, and says so in the log.
 */
export const MAX_RETRY_AFTER_MS = 2_000;

/** `retry-after` in milliseconds, from delta-seconds or an HTTP date; null when unusable. */
export function retryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (header === null) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

function jitter(baseMs: number): number {
  return Math.round(baseMs * (0.5 + Math.random()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `work`, or an AbortError as soon as `signal` aborts — whichever comes first.
 *
 * The AbortSignal handed to `fetch` is not enough on its own. When Next regenerates an
 * ISR page in the background it re-issues a stale tagged fetch WITHOUT the caller's
 * signal (`next/dist/server/lib/patch-fetch.js`: "don't pass through signal when
 * revalidating"), so the timeout never reaches the request. From 29/09/2026 ~20:30 UTC
 * the home kept serving a stale render for two days: its background regeneration hung
 * on a Kal El call nobody could abort, Next will not start a second one for the same
 * page while the first is pending, and pages with no cached copy hung for every visitor.
 * Racing the promise against the signal bounds the READ even when the request itself
 * cannot be cancelled; the orphaned socket is left to undici's own timeouts.
 */
export function withDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    work.catch(() => {});
    return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      work.catch(() => {});
      reject(new DOMException('The operation was aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

/**
 * The `x-correlation-id` of a read: derived from the URL when Next caches the read,
 * unique per call when it does not.
 *
 * Next 15 keys its data cache on the request headers as well as the URL —
 * `generateCacheKey` in `next/dist/server/lib/incremental-cache/index.js` drops only the
 * W3C trace headers. With a fresh `randomUUID()` per call no cached read ever hit: every
 * render and every ISR regeneration re-read everything from Kal El, and every read
 * stored one more entry in the in-memory LRU that pages share (`next-cache-handler.mjs`).
 * Measured against the stand-in CMS on 18/11/2026 (DECISIONS §7.33): a build made 1,507
 * reads; the same `/legado` request read 6 times on every visit.
 *
 * The same URL always gets the same id, so a portal log line (`kalel.read.error`,
 * `discovery.degraded`) still points at the read that failed. Nothing on Kal El's side
 * depends on it being unique: the CMS mints its own request id and does not record this
 * header. A `no-store` read never reaches the cache and keeps an id of its own per call.
 */
export function readCorrelationId(url: string, req: Pick<ReadRequest, 'noStore' | 'correlationId'>): string {
  if (req.noStore) return req.correlationId ?? randomUUID();
  return `kalel-${createHash('sha256').update(`GET ${url}`).digest('hex').slice(0, 16)}`;
}

/**
 * The id of the retry of a cached read: a key of its own, shared for one minute.
 *
 * Next stores any 200 before the transport has looked at the body, so an answer the
 * first attempt rejects — outside the contract, or not JSON at all — may be one the data
 * cache kept, and under the same key the retry would be handed it again (Next even waits
 * on the same per-key lock). With an hour-long window and the CMS already fixed, that is
 * an hour of a broken site that only a restart would end. A key per minute bounds both
 * sides: the CMS is asked at most once a minute per address while it keeps answering
 * badly, and the site recovers within a minute of the CMS being fixed.
 */
export function retryCorrelationId(id: string, now: number = Date.now()): string {
  return `${id}-r${Math.floor(now / 60_000).toString(36)}`;
}

/** Transport events that are alerts rather than dependency blips (RUNBOOK §2). */
const ALERT_EVENTS: ReadonlySet<string> = new Set(['kalel.contract.violation', 'kalel.read.rate-limited']);

/**
 * Where the transport's events go when the caller does not say: the structured logger,
 * at `error` for an alert and `warn` for everything else it reports.
 */
export function logTransportEvent(event: string, meta: Record<string, unknown>): void {
  if (ALERT_EVENTS.has(event)) logger.error(event, meta);
  else logger.warn(event, meta);
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
      // The one construction site the application uses, so the one place a missing
      // logger would silently drop `kalel.contract.violation`.
      onLog: logTransportEvent,
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
    const url = this.url(req.path, req.query);
    // Part of the cache key: see `readCorrelationId` before making it vary per call.
    const correlationId = readCorrelationId(url, req);
    const envelope = kalelEnvelope(schema);

    let lastError: unknown;
    // Set when a cached read got a 200 whose body was refused — possibly a stored one.
    let refusedBody = false;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      const isLastAttempt = attempt === 1 || req.retry === false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      // Every await on the network below goes through the deadline: see `withDeadline`.
      const bounded = <V>(work: Promise<V>) => withDeadline(work, controller.signal);
      // Only a refused 200 can be a stored answer, so only its retry changes key; a 5xx or
      // a 429 is never stored, and its retry fills the read's own entry.
      const headerId = refusedBody ? retryCorrelationId(correlationId) : correlationId;
      /**
       * A cached read whose 200 cannot be used: one more try, at once, under its own key
       * (`retryCorrelationId`) — the point is to change key, not to wait out a blip. That
       * tells a CMS still answering badly from a bad answer the data cache kept. Logged at
       * `warn`, since a good retry would otherwise hide that the stored entry is still
       * there, costing a request until its window runs out.
       */
      const retryRefusedBody = (reason: string, err: unknown): boolean => {
        if (req.noStore || isLastAttempt) return false;
        refusedBody = true;
        lastError = err;
        clearTimeout(timer);
        this.onLog('kalel.read.cached-unusable', { correlationId, path: req.path, reason });
        return true;
      };
      try {
        const res = await bounded(
          this.fetchImpl(url, {
            method: 'GET',
            headers: {
              authorization: `Bearer ${this.token}`,
              accept: 'application/json',
              'x-correlation-id': headerId,
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
          }),
        );

        if (res.status === 404) throw ContentError.notFound(req.path, correlationId);
        if (res.status === 401 || res.status === 403) {
          throw new ContentError('unauthorized', 'Kal El rejected the service credential', {
            correlationId,
            status: res.status,
          });
        }
        if (res.status === 429) {
          const detail = await bounded(this.errorDetail(res));
          const asked = retryAfterMs(res.headers.get('retry-after'));
          const err = ContentError.unavailable(`Kal El GET ${req.path} was rate limited`, {
            correlationId,
            status: 429,
          });
          // No `retry-after` at all is not Kal El's limiter talking — a proxy, most likely —
          // so it gets the same short jittered retry as any other blip.
          const waitMs = asked ?? jitter(200);
          if (!isLastAttempt && waitMs <= MAX_RETRY_AFTER_MS) {
            lastError = err;
            clearTimeout(timer);
            await sleep(waitMs);
            continue;
          }
          this.onLog('kalel.read.rate-limited', {
            correlationId,
            path: req.path,
            retryAfterMs: asked,
            attempts: attempt + 1,
            detail,
          });
          throw err;
        }
        if (!res.ok) {
          const detail = await bounded(this.errorDetail(res));
          const err = ContentError.unavailable(`Kal El GET ${req.path} failed with ${res.status}`, {
            correlationId,
            status: res.status,
          });
          this.onLog('kalel.read.error', { correlationId, path: req.path, status: res.status, detail });
          if (RETRYABLE.has(res.status) && !isLastAttempt) {
            lastError = err;
            clearTimeout(timer);
            await sleep(jitter(200));
            continue;
          }
          throw err;
        }

        let json: unknown;
        try {
          json = await bounded(res.json());
        } catch (err) {
          // A 200 that is not JSON — a proxy's page — is stored like any other 200.
          const aborted = err instanceof Error && err.name === 'AbortError';
          if (!aborted && retryRefusedBody('not-json', err)) continue;
          throw err;
        }
        const parsed = envelope.safeParse(json);
        if (!parsed.success) {
          const detail = parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          const err = ContentError.contract(`Kal El response for ${req.path} does not satisfy the agreed schema`, {
            correlationId,
            detail,
          });
          // Only the answer that stands is an alert: see `retryRefusedBody`.
          if (retryRefusedBody('contract', err)) continue;
          this.onLog('kalel.contract.violation', { correlationId, path: req.path, detail });
          throw err;
        }
        return parsed.data.data as z.infer<T>;
      } catch (err) {
        clearTimeout(timer);
        // Editorial 404s and credential rejections are terminal, and so is a contract
        // violation once retried (above): repeating them only doubles the latency of a
        // failure that will not change.
        if (err instanceof ContentError) throw err;
        lastError = err;
        const aborted = err instanceof Error && err.name === 'AbortError';
        if (!isLastAttempt) {
          await sleep(jitter(200));
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
