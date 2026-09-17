import { createHash } from 'node:crypto';

import { z } from 'zod';

import { CliError, retryAfterMs, sleep as realSleep } from './cli';
import { idempotencyKey } from './state';

/**
 * Kal El as the import target.
 *
 * Thin on purpose: the import tools care about *idempotence*, not about HTTP. Every
 * create carries an `Idempotency-Key` derived from the source entity, and every entity
 * that supports it carries an `externalKey` — those two together are what make a second
 * run update instead of duplicate.
 *
 * `--apply` gates every method here. Without it the caller never constructs this class,
 * so a dry run cannot write by accident: there is no code path from dry run to POST.
 */

export interface TargetOptions {
  baseUrl: string;
  token: string;
  siteId: string;
  fetchImpl?: typeof fetch;
  /** Waiting, injectable so a test does not sit through a real `Retry-After`. */
  sleep?: (ms: number) => Promise<void>;
  /** How many 429 answers one request may receive before it is reported as failed. */
  maxRateLimitRetries?: number;
}

/**
 * `GET /media/storage`: where the media bytes live and how much room is left.
 *
 * Sizes are `null` when the provider cannot tell — object storage has no meaningful free
 * space to report.
 */
export const kalelMediaStorageSchema = z.object({
  provider: z.string().min(1),
  totalBytes: z.number().int().nonnegative().nullable(),
  freeBytes: z.number().int().nonnegative().nullable(),
});

export type KalElMediaStorage = z.infer<typeof kalelMediaStorageSchema>;

/**
 * The `Idempotency-Key` of one upload.
 *
 * Two constraints, both learned from the CMS rather than chosen. Kal El accepts only
 * `[A-Za-z0-9._-]` in the header and answers 400 to anything else — and the key used to be
 * the raw `externalKey`, whose colons made every single upload a 400. And it hashes the
 * request with the file's digest, so the same key sent with different bytes is refused
 * as a replay: a third-party CDN is free to re-encode an image between two downloads,
 * and that must read as a new request, not as a conflict that blocks the image for the
 * key's whole lifetime. So the key carries the digest of the bytes it is sent with.
 */
export function mediaIdempotencyKey(externalKey: string, data: Buffer): string {
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 16);
  return idempotencyKey('media', `${externalKey}.${digest}`);
}

export class KalElTarget {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly siteId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRateLimitRetries: number;
  /**
   * When the CMS last said "not before". Shared by every request this instance makes:
   * with several lanes running, the one that hears the 429 is not the only one about to
   * send, and letting the others find out one by one spends the next window's budget on
   * refusals.
   */
  private pausedUntil = 0;

  constructor(opts: TargetOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.siteId = opts.siteId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? realSleep;
    this.maxRateLimitRetries = opts.maxRateLimitRetries ?? 12;
  }

  static fromEnv(overrides: Partial<TargetOptions> = {}): KalElTarget {
    const baseUrl = process.env.KAL_EL_BASE_URL;
    const token = process.env.KAL_EL_SERVICE_TOKEN;
    const siteId = process.env.KAL_EL_SITE_ID;
    if (!baseUrl || !token || !siteId) {
      throw new CliError('KAL_EL_BASE_URL, KAL_EL_SERVICE_TOKEN and KAL_EL_SITE_ID are required to apply an import');
    }
    return new KalElTarget({ baseUrl, token, siteId, ...overrides });
  }

  private site(path: string): string {
    return `${this.baseUrl}/v1/sites/${this.siteId}${path}`;
  }

  /**
   * One request, retried while the CMS answers 429.
   *
   * Kal El limits a service token to `RATE_LIMIT_MAX` requests a minute (600 by default)
   * and says how long to wait in `Retry-After`. A 429 is refused before any handler runs,
   * so repeating the request is safe for every method, a PATCH included. Nothing else is
   * retried here: a 5xx on a PATCH may have landed, and sending it again would turn the
   * importer's own write into a version conflict it then reports as an editor's.
   *
   * `init` is a factory because a request is not reusable across attempts — the timeout
   * signal would already be running down during the wait.
   */
  private async send(url: string, init: () => RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = this.pausedUntil - Date.now();
      if (wait > 0) await this.sleep(wait);

      const res = await this.fetchImpl(url, init());
      if (res.status !== 429 || attempt >= this.maxRateLimitRetries) return res;

      await res.body?.cancel().catch(() => undefined);
      const delay = retryAfterMs(res.headers.get('retry-after'));
      this.pausedUntil = Math.max(this.pausedUntil, Date.now() + delay);
    }
  }

  private async json<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<{ status: number; data: T | null; error: string | null }> {
    const res = await this.send(this.site(path), () => ({
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    }));

    const text = await res.text();
    let parsed: { data?: T; error?: { code?: string; message?: string } } | undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }

    return {
      status: res.status,
      data: parsed?.data ?? null,
      // The message is echoed for the report; the token never appears in it.
      error: res.ok ? null : (parsed?.error?.code ?? `HTTP ${res.status}`),
    };
  }

  /**
   * Finds an article previously imported from the same source item.
   *
   * This is the idempotence check: `externalKey` is unique per site in Kal El, so a
   * second run finds the first run's article instead of creating a twin.
   */
  async findArticleByExternalKey(externalKey: string): Promise<{ id: string; version: number } | null> {
    const res = await this.json<{ items: { id: string; version: number }[] }>(
      'GET',
      `/articles?externalKey=${encodeURIComponent(externalKey)}&limit=1`,
    );
    // "I could not check" is not "it does not exist". Collapsing the two means a CMS
    // hiccup during the lookup sends the importer down the create path for an article
    // that is already there — which `externalKey` uniqueness then refuses, so the article
    // is never updated and every later run repeats the same wasted attempt.
    if (res.error !== null || res.data === null) {
      throw new CliError(`could not check whether ${externalKey} is already imported: ${res.error ?? 'no data'}`);
    }
    const first = res.data.items?.[0];
    return first ? { id: first.id, version: first.version } : null;
  }

  async findMediaByExternalKey(externalKey: string): Promise<{ id: string } | null> {
    // Kal El has no externalKey filter on media, so the library is scanned once and
    // indexed by the caller. This method exists for symmetry and for the single-item case.
    const res = await this.json<{ items: { id: string; externalKey: string | null }[]; total: number }>(
      'GET',
      `/media?limit=200`,
    );
    const hit = res.data?.items?.find((m) => m.externalKey === externalKey);
    return hit ? { id: hit.id } : null;
  }

  /**
   * Full media index, keyed by `externalKey`, for deduplication across a whole run.
   *
   * Read to the end, and refused when it cannot be. The walk used to stop at 200 pages —
   * 40.000 rows, against an archive of 73.173 attachments plus the hotlinked images — and
   * to treat a failed page as the last one. Either way the index came back short without
   * saying so, and every asset past the cut was downloaded and sent again on a re-run.
   */
  async mediaIndexByExternalKey(): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    let offset = 0;
    for (;;) {
      const res = await this.json<{ items: { id: string; externalKey: string | null }[]; total: number }>(
        'GET',
        `/media?limit=200&offset=${offset}`,
      );
      if (res.error !== null || res.data === null) {
        throw new CliError(`could not read the media library at offset ${offset}: ${res.error ?? 'no data'}`);
      }
      const items = res.data.items ?? [];
      for (const item of items) if (item.externalKey) index.set(item.externalKey, item.id);
      offset += items.length;
      // A short page before `total` means rows went away mid-walk. Stopping is right: what
      // was not read is at worst sent again, and Kal El answers a known externalKey with
      // the row it already has.
      if (items.length === 0 || offset >= (res.data.total ?? 0)) break;
    }
    return index;
  }

  /**
   * How much room the media storage has left.
   *
   * 404 on an instance that predates the endpoint, 403 without `media.manage` — the
   * caller decides what either means; this only reports it.
   */
  async mediaStorage(): Promise<{ status: number; data: KalElMediaStorage | null; error: string | null }> {
    const res = await this.json<unknown>('GET', '/media/storage');
    if (res.error !== null) return { status: res.status, data: null, error: res.error };
    const parsed = kalelMediaStorageSchema.safeParse(res.data);
    if (!parsed.success) return { status: res.status, data: null, error: 'unexpected storage response' };
    return { status: res.status, data: parsed.data, error: null };
  }

  async createCategory(
    body: { name: string; slug: string; description?: string | null; parentId?: string | null },
    key: string,
  ) {
    return this.json<{ id: string }>('POST', '/categories', body, key);
  }

  async createTag(body: { name: string; slug: string }, key: string) {
    return this.json<{ id: string }>('POST', '/tags', body, key);
  }

  async createAuthor(body: { name: string; slug: string; bio?: string | null }, key: string) {
    return this.json<{ id: string }>('POST', '/authors', body, key);
  }

  async listCategories() {
    return this.json<{ id: string; slug: string }[]>('GET', '/categories');
  }

  async listTags() {
    return this.json<{ id: string; slug: string }[]>('GET', '/tags');
  }

  async listAuthors() {
    return this.json<{ id: string; slug: string }[]>('GET', '/authors');
  }

  /**
   * Multipart upload. `externalKey` is what makes a repeated upload return the first row.
   *
   * It travels in the **query string**, which is where Kal El reads it. It used to be a
   * form field, which the CMS never looks at: every row was stored with no external key,
   * so neither the CMS's own deduplication nor `mediaIndexByExternalKey` could recognise
   * an asset a previous run had already sent.
   */
  async uploadMedia(
    filename: string,
    data: Buffer,
    mimeType: string,
    externalKey: string,
  ): Promise<{ status: number; id: string | null; error: string | null }> {
    const url = `${this.site('/media')}?externalKey=${encodeURIComponent(externalKey)}`;
    const key = mediaIdempotencyKey(externalKey, data);
    const res = await this.send(url, () => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), filename);
      return {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'idempotency-key': key },
        body: form,
        signal: AbortSignal.timeout(120_000),
      };
    });
    const text = await res.text();
    let parsed: { data?: { id: string }; error?: { code?: string } } | undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    return {
      status: res.status,
      id: parsed?.data?.id ?? null,
      error: res.ok ? null : (parsed?.error?.code ?? `HTTP ${res.status}`),
    };
  }

  async updateMediaMetadata(
    mediaId: string,
    body: { altText?: string | null; caption?: string | null; credit?: string | null },
  ) {
    return this.json<{ id: string }>('PATCH', `/media/${mediaId}`, body);
  }

  async createArticle(body: Record<string, unknown>, key: string) {
    return this.json<{ id: string; version: number }>('POST', '/articles', body, key);
  }

  /**
   * Updates an existing article.
   *
   * `If-Match` carries the version the caller read, so a concurrent editorial change
   * loses to a 409 rather than being silently overwritten by the importer.
   */
  async updateArticle(articleId: string, body: Record<string, unknown>, version: number) {
    const res = await this.send(this.site(`/articles/${articleId}`), () => ({
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'if-match': String(version),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    }));
    const text = await res.text();
    let parsed: { data?: { id: string; version: number }; error?: { code?: string } } | undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    return {
      status: res.status,
      data: parsed?.data ?? null,
      error: res.ok ? null : (parsed?.error?.code ?? `HTTP ${res.status}`),
    };
  }

  async createRedirect(body: { sourcePath: string; targetPath: string; kind: '301' | '302' }, key: string) {
    return this.json<{ id: string }>('POST', '/redirects', body, key);
  }

  async listRedirects() {
    return this.json<{ id: string; sourcePath: string; targetPath: string; kind: string }[]>('GET', '/redirects');
  }
}
