import { lookup as dnsLookup } from 'node:dns/promises';

import { z } from 'zod';

import { isPrivateHost } from '@mn/content/security/address';

import { CliError, rateLimiter } from './cli';

/**
 * WordPress as a read-only source.
 *
 * Nothing here writes to WordPress — not a post, not a term, not a redirect, not a
 * plugin setting. The charter is explicit about that, and it matters operationally: the
 * legacy site stays live and unchanged for the thirty days after the switch.
 *
 * **Reads go through the REST API, and only the REST API.** There is no `--wxr` flag and
 * no SQL reader; an earlier version of this comment claimed the first one, which was a
 * lie a reader could not detect until the day it mattered.
 *
 * An archive that arrives as a database dump is therefore restored locally and served by
 * a WordPress the importer can talk to — the procedure is in the runbook, and
 * `pnpm import:sandbox` is the same shape with stand-ins in place of the real archive.
 * Adding a file reader later means implementing this class's async-generator surface and
 * nothing else; every consumer speaks to that, not to HTTP.
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
  /** Name resolution, injectable so the SSRF guard is testable without a resolver. */
  lookupImpl?: (host: string) => Promise<string[]>;
  /**
   * Permit assets on private or loopback addresses.
   *
   * Exists for one reason: a rehearsal against a WordPress restored on the operator's own
   * machine. The caller is responsible for proving the whole run is local — `import.ts`
   * refuses the flag unless *every* configured endpoint is loopback, so it cannot be
   * switched on for a run that can reach anything real.
   */
  allowPrivateHosts?: boolean;
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
  allowPrivateHosts = false,
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
  // A non-standard port is refused for the same reason a private address is: it is how
  // an asset URL reaches an internal service. Both concessions are made together, and
  // only for a rehearsal that `import.ts` has proved is entirely local.
  if (!allowPrivateHosts && url.port !== '' && !['80', '443'].includes(url.port)) {
    return { ok: false, reason: `port ${url.port}` };
  }

  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host)) return { ok: false, reason: `host ${host} is not the source origin` };
  if (!allowPrivateHosts && isPrivateHost(host)) {
    return { ok: false, reason: `host ${host} is a private address` };
  }
  return { ok: true, url };
}

/**
 * Re-exported so the importer's guard and the runtime's guard are provably the same
 * function. They were two copies once, and the copy in this file was the one that knew
 * about IPv6 while the other did not.
 */
export { isPrivateHost as isPrivateAddress } from '@mn/content/security/address';

/** Every address a name resolves to — all of them, since any one would be used. */
async function defaultLookup(host: string): Promise<string[]> {
  const records = await dnsLookup(host, { all: true });
  return records.map((r) => r.address);
}

export class WordPressSource {
  private readonly baseUrl: string;
  private readonly auth: string | undefined;
  private readonly pace: () => Promise<void>;
  private readonly fetchImpl: typeof fetch;
  /** Hosts an asset may legitimately come from: the source origin, plus any CDN. */
  private readonly assetHosts: Set<string>;
  private readonly lookupImpl: (host: string) => Promise<string[]>;
  private readonly allowPrivateHosts: boolean;

  constructor(opts: SourceOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.auth = opts.auth;
    this.pace = rateLimiter(opts.requestsPerSecond ?? 4);
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.assetHosts = new Set([new URL(this.baseUrl).hostname, ...(opts.assetHosts ?? [])].map((h) => h.toLowerCase()));
    this.lookupImpl = opts.lookupImpl ?? defaultLookup;
    this.allowPrivateHosts = opts.allowPrivateHosts === true;
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
   * Whether a hostname resolves only to addresses outside the private ranges.
   *
   * The allowlist alone is not enough. A name the operator allowed — a CDN, a legacy
   * hostname still in someone else's DNS — can be pointed at 169.254.169.254 or at an
   * internal admin service, and the fetch would be made from inside the network with
   * whatever the operator's machine can reach.
   *
   * Resolving here and rejecting on any private answer closes that. It does not pin the
   * address the socket finally connects to, so a name that changes its answer between
   * this lookup and the connection is still theoretically possible; closing that last
   * gap needs a connection-level dispatcher, and is recorded as such in the runbook.
   */
  private async resolvesPublicly(host: string): Promise<boolean> {
    // The local-rehearsal escape hatch. The host allowlist still applies: this only
    // stops the address check from refusing a loopback host the operator declared.
    if (this.allowPrivateHosts) return true;
    if (isPrivateHost(host)) return false;
    // A literal IP has already been judged; resolving it again proves nothing.
    if (/^[d.]+$/.test(host) || host.includes(':')) return true;
    try {
      const addresses = await this.lookupImpl(host);
      return addresses.length > 0 && addresses.every((a) => !isPrivateHost(a.toLowerCase()));
    } catch {
      // A name that will not resolve is not a name worth fetching from.
      return false;
    }
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
      const allowed = assetUrlAllowed(current, this.assetHosts, this.allowPrivateHosts);
      if (!allowed.ok) return null;
      if (!(await this.resolvesPublicly(allowed.url.hostname))) return null;

      await this.pace();
      const res = await this.fetchImpl(allowed.url.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
      });

      if (res.status >= 300 && res.status < 400) {
        // Nothing here reads the redirect's body, and an unread body holds the
        // connection open for the rest of the run.
        await res.body?.cancel().catch(() => undefined);
        const location = res.headers.get('location');
        if (!location) return null;
        current = new URL(location, allowed.url).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        return null;
      }

      const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream';
      const declared = Number(res.headers.get('content-length') ?? '0');
      if (declared > maxBytes) return null;
      const data = await readCapped(res, maxBytes);
      return data ? { data, mimeType } : null;
    }
    return null;
  }
}

/**
 * Reads a body without ever holding more than `maxBytes` of it.
 *
 * `Content-Length` is written by the source server, so checking it and then calling
 * `arrayBuffer()` lets that server decide how much memory the importer allocates: it can
 * declare 4 KB and send 4 GB. Reading incrementally and cancelling at the limit means
 * the lie costs one chunk, and cancelling ends the transfer rather than draining it.
 */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
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
