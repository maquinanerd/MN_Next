import { CliError } from './cli';

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
}

export class KalElTarget {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly siteId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TargetOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.siteId = opts.siteId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
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

  private async json<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<{ status: number; data: T | null; error: string | null }> {
    const res = await this.fetchImpl(this.site(path), {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

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

  /** Full media index, keyed by `externalKey`, for deduplication across a whole run. */
  async mediaIndexByExternalKey(): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    let offset = 0;
    for (let page = 0; page < 200; page += 1) {
      const res = await this.json<{ items: { id: string; externalKey: string | null }[]; total: number }>(
        'GET',
        `/media?limit=200&offset=${offset}`,
      );
      const items = res.data?.items ?? [];
      for (const item of items) if (item.externalKey) index.set(item.externalKey, item.id);
      offset += items.length;
      if (items.length === 0 || offset >= (res.data?.total ?? 0)) break;
    }
    return index;
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

  /** Multipart upload. `externalKey` is what makes a repeated upload return the first row. */
  async uploadMedia(
    filename: string,
    data: Buffer,
    mimeType: string,
    externalKey: string,
  ): Promise<{ status: number; id: string | null; error: string | null }> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), filename);
    form.append('externalKey', externalKey);

    const res = await this.fetchImpl(this.site('/media'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'idempotency-key': `wp.media.${externalKey}`.slice(0, 128),
      },
      body: form,
      signal: AbortSignal.timeout(120_000),
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
    const res = await this.fetchImpl(this.site(`/articles/${articleId}`), {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'if-match': String(version),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
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
