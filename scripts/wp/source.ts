import { z } from 'zod';

import { CliError, rateLimiter } from './cli';

/**
 * WordPress as a read-only source.
 *
 * Nothing here writes to WordPress — not a post, not a term, not a redirect, not a
 * plugin setting. The charter is explicit about that, and it matters operationally: the
 * legacy site stays live and unchanged for the thirty days after the switch.
 *
 * Reads go through the REST API. A WXR export is the fallback when the API is closed;
 * `--wxr` points at the file and the same normalisation runs over it.
 */

const wpRendered = z.object({ rendered: z.string() }).transform((v) => v.rendered);

export const wpPostSchema = z.object({
  id: z.number().int(),
  date_gmt: z.string(),
  modified_gmt: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  link: z.string(),
  title: wpRendered,
  content: wpRendered,
  excerpt: wpRendered,
  author: z.number().int(),
  featured_media: z.number().int(),
  categories: z.array(z.number().int()).default([]),
  tags: z.array(z.number().int()).default([]),
});

export const wpTermSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  description: z.string().default(''),
  parent: z.number().int().optional(),
  count: z.number().int().optional(),
});

export const wpAuthorSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  description: z.string().default(''),
});

export const wpMediaSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  source_url: z.string(),
  mime_type: z.string(),
  alt_text: z.string().default(''),
  caption: wpRendered.optional(),
  media_details: z
    .object({
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      file: z.string().optional(),
    })
    .default({}),
});

export type WpPost = z.infer<typeof wpPostSchema>;
export type WpTerm = z.infer<typeof wpTermSchema>;
export type WpAuthor = z.infer<typeof wpAuthorSchema>;
export type WpMedia = z.infer<typeof wpMediaSchema>;

export interface SourceOptions {
  baseUrl: string;
  /** Extra hosts assets may come from — a CDN in front of the media library. */
  assetHosts?: string[];
  /** Application password, only needed for non-public content. Never logged. */
  auth?: string;
  requestsPerSecond?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Whether an asset URL may be fetched.
 *
 * A media record's `source_url` is data from the legacy system, not a constant. During a
 * migration the importer runs with network access to whatever the operator's machine can
 * reach, so an attacker-influenced media row is a request forgery primitive: it could
 * point at a cloud metadata endpoint or an internal admin service and the importer would
 * dutifully fetch it.
 *
 * Two rules close that: the host must be the WordPress origin itself (or one the
 * operator allowed explicitly), and the address must not be private. Both are re-checked
 * on every redirect hop, because the first response is free to point somewhere else.
 */
export function assetUrlAllowed(
  raw: string,
  allowedHosts: Set<string>,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'not a URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: `scheme ${url.protocol}` };
  // Credentials in a URL are how a fetch gets aimed at something that trusts them.
  if (url.username !== '' || url.password !== '') return { ok: false, reason: 'credentials in URL' };
  if (url.port !== '' && !['80', '443'].includes(url.port)) return { ok: false, reason: `port ${url.port}` };

  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host)) return { ok: false, reason: `host ${host} is not the source origin` };
  if (isPrivateAddress(host)) return { ok: false, reason: `host ${host} resolves to a private address` };
  return { ok: true, url };
}

/**
 * Literal private, loopback and link-local addresses.
 *
 * This is a syntactic check, not a DNS one: a hostname that *resolves* to a private
 * address still passes here. The host allowlist is what actually carries the weight —
 * this only stops the obvious case of a media row pointing straight at an IP.
 */
export function isPrivateAddress(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return true;
  }
  if (host === '::1' || host.startsWith('[')) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export class WordPressSource {
  private readonly baseUrl: string;
  private readonly auth: string | undefined;
  private readonly pace: () => Promise<void>;
  private readonly fetchImpl: typeof fetch;
  /** Hosts an asset may legitimately come from: the source origin, plus any CDN. */
  private readonly assetHosts: Set<string>;

  constructor(opts: SourceOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.auth = opts.auth;
    this.pace = rateLimiter(opts.requestsPerSecond ?? 4);
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.assetHosts = new Set([new URL(this.baseUrl).hostname, ...(opts.assetHosts ?? [])].map((h) => h.toLowerCase()));
  }

  static fromEnv(overrides: Partial<SourceOptions> = {}): WordPressSource {
    const baseUrl = process.env.WP_BASE_URL;
    if (!baseUrl) throw new CliError('WP_BASE_URL is not set');
    return new WordPressSource({
      baseUrl,
      ...(process.env.WP_APPLICATION_PASSWORD ? { auth: process.env.WP_APPLICATION_PASSWORD } : {}),
      ...(process.env.WP_ASSET_HOSTS
        ? {
            assetHosts: process.env.WP_ASSET_HOSTS.split(',')
              .map((h) => h.trim())
              .filter(Boolean),
          }
        : {}),
      ...overrides,
    });
  }

  /**
   * One page of a collection.
   *
   * WordPress reports the total page count in `X-WP-TotalPages`, which is what bounds
   * the walk — trusting an empty page instead would stop early on a transient error.
   */
  private async page<T extends z.ZodTypeAny>(
    resource: string,
    schema: T,
    page: number,
    perPage: number,
    query: Record<string, string> = {},
  ): Promise<{ items: z.infer<T>[]; totalPages: number }> {
    await this.pace();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage), ...query });
    const url = `${this.baseUrl}/wp-json/wp/v2/${resource}?${qs.toString()}`;
    const res = await this.fetchImpl(url, {
      headers: {
        accept: 'application/json',
        ...(this.auth ? { authorization: `Basic ${Buffer.from(this.auth).toString('base64')}` } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 400 && page > 1) return { items: [], totalPages: page - 1 };
    if (!res.ok) throw new CliError(`WordPress ${resource} page ${page} returned ${res.status}`);

    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1') || 1;
    const json: unknown = await res.json();
    const parsed = z.array(schema).safeParse(json);
    if (!parsed.success) {
      throw new CliError(`WordPress ${resource} page ${page} did not match the expected shape`);
    }
    return { items: parsed.data, totalPages };
  }

  /** Walks a collection, yielding one page at a time so nothing is held in memory twice. */
  async *collection<T extends z.ZodTypeAny>(
    resource: string,
    schema: T,
    query: Record<string, string> = {},
    perPage = 50,
  ): AsyncGenerator<z.infer<T>[]> {
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.page(resource, schema, page, perPage, query);
      if (result.items.length === 0) return;
      totalPages = result.totalPages;
      yield result.items;
      page += 1;
    } while (page <= totalPages);
  }

  posts(since?: string) {
    return this.collection('posts', wpPostSchema, {
      status: 'publish',
      orderby: 'modified',
      order: 'asc',
      ...(since ? { modified_after: since } : {}),
    });
  }

  categories() {
    return this.collection('categories', wpTermSchema, { orderby: 'id', order: 'asc' }, 100);
  }

  tags() {
    return this.collection('tags', wpTermSchema, { orderby: 'id', order: 'asc' }, 100);
  }

  authors() {
    return this.collection('users', wpAuthorSchema, {}, 100);
  }

  media() {
    return this.collection('media', wpMediaSchema, { orderby: 'id', order: 'asc' }, 100);
  }

  /**
   * Downloads one asset, bounded by size, host and hop count.
   *
   * `redirect: 'manual'` is the point: following redirects automatically would let the
   * first response — which the source system controls — send the fetch anywhere, and the
   * allowlist would only ever have checked the first URL.
   */
  async fetchAsset(url: string, maxBytes: number, maxHops = 3): Promise<{ data: Buffer; mimeType: string } | null> {
    let current = url;

    for (let hop = 0; hop <= maxHops; hop += 1) {
      const allowed = assetUrlAllowed(current, this.assetHosts);
      if (!allowed.ok) return null;

      await this.pace();
      const res = await this.fetchImpl(allowed.url.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        current = new URL(location, allowed.url).toString();
        continue;
      }
      if (!res.ok) return null;

      const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream';
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > maxBytes) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      // The declared length is a hint, not a promise; the real one is what counts.
      if (buffer.byteLength > maxBytes) return null;
      return { data: buffer, mimeType };
    }
    return null;
  }
}

/** Raster formats only. An SVG from a ten-year archive is active content, not an image. */
export const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

/**
 * Magic-byte check, mirroring what Kal El does on upload.
 *
 * The declared `Content-Type` is written by the source server; an executable renamed to
 * `.jpg` would otherwise be carried into the CMS and served from a trusted origin.
 */
export function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') return 'image/png';
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1').toLowerCase();
    if (['avif', 'avis', 'mif1', 'miaf'].includes(brand)) return 'image/avif';
  }
  return null;
}
