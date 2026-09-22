import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  kalelArticleListSchema,
  kalelArticleSchema,
  kalelAuthorSchema,
  kalelCategorySchema,
  kalelEntitySchema,
  kalelMediaListSchema,
  kalelMediaSchema,
  kalelPreviewSchema,
  kalelRedirectSchema,
  kalelTagSchema,
} from '../../packages/content/src/kalel/dto';
import { kalelMediaStorageSchema, type KalElMediaStorage } from '../../scripts/wp/target';
import { SERVICE_TOKEN, SITE_ID, all, type Row } from './corpus';
import { handleWrite } from './writes';

/**
 * A stand-in for Kal El, faithful to the contract rather than to the caller.
 *
 * Two rules keep this honest, and both matter more than the endpoints themselves:
 *
 *  1. **Every response is validated before it is sent.** Not against a schema written
 *     here — against `packages/content/src/kalel/dto.ts`, the same schemas the
 *     application parses with. A fake that drifts toward "whatever makes the app pass"
 *     proves nothing, so this one fails loudly instead, with a 500 naming the field.
 *  2. **It behaves like the real thing where the real thing is awkward.** Articles page
 *     by opaque cursor, or — as Kal El does since kal-el#7 — by `offset`, and then report
 *     a `total`; media pages by `limit`/`offset` and always reports `total`. Those are
 *     different models in one API, and the whole point of running against this is to
 *     catch code that assumes one. `legacyArticleList` answers lists the way Kal El did
 *     before that change, for the code paths that must survive such an instance.
 *
 * Authentication is checked the way the CMS checks it: a bearer service token, refused
 * with 401 when absent or wrong. That is what proves the delivery path never depends on
 * an unauthenticated read.
 */

export interface FakeKalElOptions {
  /**
   * Accept writes, so the WordPress importer can be run against this for real.
   *
   * Off by default: the delivery gate must not be able to mutate what it reads, or a
   * test could pass by writing the row it then asserts.
   */
  writable?: boolean;
  /** Start with nothing, so a creation count means something. */
  empty?: boolean;
  /**
   * Answer article lists as Kal El did before kal-el#7: `order` and `offset` ignored (the
   * query schema is not strict, so unknown parameters pass silently), `updatedAt` order,
   * cursor paging only, and never a `total`.
   */
  legacyArticleList?: boolean;
  /**
   * Answer tag and media lists as Kal El did before H3: `ids`, `slug`, and tag paging
   * ignored — every tag, and the first page of the whole media library.
   */
  legacyReadsById?: boolean;
  /**
   * What `GET /media/storage` reports. `'absent'` answers 404, as an instance from before
   * the endpoint does. By default: plenty of room on a local disk.
   *
   * Validated against the importer's own schema rather than the portal's, because the
   * importer is the only reader of it.
   */
  storage?: KalElMediaStorage | 'absent';
}

export interface FakeKalEl {
  url: string;
  close: () => Promise<void>;
  /** Requests seen, for asserting that a page did not fan out unreasonably. */
  requests: string[];
  /** What the store holds now — the assertion surface for an import run. */
  contents: () => { articles: Row[]; media: Row[]; categories: Row[]; tags: Row[]; authors: Row[] };
}

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

const fail = (res: ServerResponse, status: number, code: string, message: string): void =>
  json(res, status, { error: { code, message } });

/** `?ids=a,b` as Kal El reads it: absent, a set of 1 to 200 uuids, or a 400. */
function idList(raw: string | null): Set<string> | null | 'invalid' {
  if (raw === null) return null;
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (ids.length === 0 || ids.length > 200 || !ids.every((id) => uuid.test(id))) return 'invalid';
  return new Set(ids);
}

/** A one-pixel JPEG, so the media proxy has real bytes with a real magic number. */
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

type ListOrder = 'updated' | 'published';

/**
 * Cursor pagination, opaque to the caller.
 *
 * Base64 of an offset rather than the offset itself: the application must not be able to
 * do arithmetic on it, because against the real CMS it cannot. Tagged with the order it
 * was minted under, which Kal El enforces too: a cursor from one order is a 400 in the
 * other, rather than a silently wrong page.
 */
const encodeCursor = (offset: number, order: ListOrder): string =>
  Buffer.from(`${order === 'published' ? 'p' : 'u'}:${offset}`).toString('base64url');
const decodeCursor = (cursor: string | null, order: ListOrder): number | null => {
  if (!cursor) return 0;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const match = /^([pu]):(\d+)$/.exec(raw);
  if (!match?.[2] || match[1] !== (order === 'published' ? 'p' : 'u')) return null;
  return Number(match[2]);
};

/** `updatedAt DESC, id DESC` — the default order, and the only one before kal-el#7. */
const byUpdatedDesc = (a: Row, b: Row): number =>
  String(b['updatedAt']).localeCompare(String(a['updatedAt'])) || b.id.localeCompare(a.id);

/** `published_at DESC NULLS LAST, id DESC`, as `order=published` asks. */
const byPublishedDesc = (a: Row, b: Row): number => {
  const pa = typeof a['publishedAt'] === 'string' ? a['publishedAt'] : null;
  const pb = typeof b['publishedAt'] === 'string' ? b['publishedAt'] : null;
  if (pa === pb) return b.id.localeCompare(a.id);
  if (pa === null) return 1;
  if (pb === null) return -1;
  return pb.localeCompare(pa);
};

function summarise(article: Row): Row {
  const { document: _document, seo: _seo, provenance: _provenance, workflowNote: _note, ...summary } = article;
  return summary;
}

export async function startFakeKalEl(port = 0, options: FakeKalElOptions = {}): Promise<FakeKalEl> {
  const requests: string[] = [];

  // A mutable copy. The read-only gate never touches it; the import gate fills it.
  const store = {
    articles: options.empty ? [] : [...all.articles],
    media: options.empty ? [] : [...all.media],
    categories: options.empty ? [] : [...all.categories],
    tags: options.empty ? [] : [...all.tags],
    authors: options.empty ? [] : [...all.authors],
    entities: options.empty ? [] : [...all.entities],
    redirects: options.empty ? [] : [...all.redirects],
  };
  let nextId = 1;
  const mint = (kind: number): string => {
    const n = nextId++;
    return `${kind.toString(16).padStart(8, '0')}-${n.toString(16).padStart(4, '0')}-4000-9000-${n.toString(16).padStart(12, '0')}`;
  };
  /** Idempotency keys already honoured, so a retry returns the first result. */
  const idempotent = new Map<string, unknown>();

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://fake.local');
    const path = url.pathname;
    requests.push(`${req.method} ${path}`);

    // Health is public, exactly as it is on the real CMS.
    if (path === '/health' || path === '/v1/health' || path === '/ready' || path === '/v1/ready') {
      return json(res, 200, { data: { status: 'ok' } });
    }

    // Preview redeems a capability token; it carries no service token by design.
    const preview = /^\/v1\/preview\/(.+)$/.exec(path);
    if (preview?.[1]) {
      try {
        const token = decodeURIComponent(preview[1]);
        if (token !== previewTokenFor(all.draftArticle['slug'] as string)) {
          return fail(res, 404, 'not_found', 'preview token is unknown or expired');
        }
        const draft = all.draftArticle;
        // A *subset* of the article, plus the site — not the row. Sending the whole row
        // was wrong in a way that mattered: the real CMS returns exactly these nine
        // fields and a `site` object (apps/api/src/services/preview.ts), and the
        // application's schema requires the site. The first version of this fake sent
        // neither, and the positive preview test is what found it.
        const body = {
          article: {
            id: draft['id'],
            title: draft['title'],
            dek: draft['dek'],
            slug: draft['slug'],
            status: draft['status'],
            document: draft['document'],
            seo: draft['seo'],
            featuredMediaId: draft['featuredMediaId'],
            publishedAt: draft['publishedAt'],
          },
          site: { slug: 'maquina-nerd', name: 'Máquina Nerd' },
        };
        return json(res, 200, { data: kalelPreviewSchema.parse(body) });
      } catch (err) {
        // Inside the try on purpose: a shape error here used to escape the handler and
        // take the whole process down, which reads as "the CMS is offline".
        return fail(res, 500, 'fake_contract_violation', err instanceof Error ? err.message : String(err));
      }
    }

    const auth = req.headers.authorization;
    if (auth !== `Bearer ${SERVICE_TOKEN}`) {
      return fail(res, 401, 'unauthorized', 'a service token is required');
    }

    const site = new RegExp(`^/v1/sites/${SITE_ID}(/.*)?$`).exec(path);
    if (!site) return fail(res, 404, 'not_found', `no route for ${path}`);
    const rest = site[1] ?? '/';
    const q = url.searchParams;

    // Writes are dispatched before the read routes, not after: the read routes match on
    // the path alone, so a POST to /articles would otherwise be answered by the *listing*
    // — a 200 with a body the caller cannot use, reported as "create failed: unknown".
    if (req.method !== 'GET') {
      // Off unless asked for: the delivery gate must not be able to mutate what it
      // reads, or a test could pass by writing the row it then asserts.
      if (!options.writable) return fail(res, 405, 'read_only', 'this instance accepts reads only');
      void handleWrite({ store, mint, idempotent, json, fail }, req, res, rest).catch((err: unknown) => {
        fail(res, 500, 'fake_error', err instanceof Error ? err.message : String(err));
      });
      return;
    }

    try {
      // ------------------------------------------------------------- articles
      if (rest === '/articles') {
        // The draft is in scope here. This is an authenticated editorial API: a list
        // with no status filter returns drafts too, and the application is expected to
        // ask for `status=published` on every public read. A fake that hid the draft
        // would have hidden a missing filter along with it.
        let items = [...store.articles, all.draftArticle].filter(
          (a) => a['status'] === (q.get('status') ?? a['status']),
        );
        if (q.get('slug')) items = items.filter((a) => a['slug'] === q.get('slug'));
        if (q.get('externalKey')) items = items.filter((a) => a['externalKey'] === q.get('externalKey'));
        if (q.get('categoryId'))
          items = items.filter((a) => (a['categories'] as string[]).includes(q.get('categoryId') ?? ''));
        if (q.get('tagId')) items = items.filter((a) => (a['tags'] as string[]).includes(q.get('tagId') ?? ''));
        if (q.get('authorId'))
          items = items.filter((a) => (a['authors'] as string[]).includes(q.get('authorId') ?? ''));
        if (q.get('q')) {
          const needle = (q.get('q') ?? '').toLowerCase();
          items = items.filter((a) => String(a['title']).toLowerCase().includes(needle));
        }
        const legacy = options.legacyArticleList === true;
        const order: ListOrder = !legacy && q.get('order') === 'published' ? 'published' : 'updated';
        items = [...items].sort(order === 'published' ? byPublishedDesc : byUpdatedDesc);

        const limit = Math.min(Math.max(Number(q.get('limit') ?? 25), 1), 100);
        const rawOffset = legacy ? null : q.get('offset');
        const rawCursor = q.get('cursor');
        if (rawOffset !== null && rawCursor) {
          return fail(res, 400, 'bad_request', 'cursor and offset cannot be combined');
        }
        let offset: number;
        if (rawOffset !== null) {
          if (!/^\d+$/.test(rawOffset) || Number(rawOffset) > 100_000) {
            return fail(res, 400, 'bad_request', 'offset must be a whole number from 0 to 100000');
          }
          offset = Number(rawOffset);
        } else {
          const decoded = decodeCursor(rawCursor, order);
          if (decoded === null) return fail(res, 400, 'bad_request', `invalid cursor for order=${order}`);
          offset = decoded;
        }
        const page = items.slice(offset, offset + limit);
        const next = offset + limit < items.length ? encodeCursor(offset + limit, order) : null;

        return json(res, 200, {
          data: kalelArticleListSchema.parse({
            items: page.map(summarise),
            nextCursor: next,
            // kal-el#7 counts the filter for any query that names an offset — offset 0 included,
            // which is what lets one request both fill a page and number the pagination.
            ...(rawOffset === null ? {} : { total: items.length }),
          }),
        });
      }

      const article = /^\/articles\/([0-9a-f-]{36})$/.exec(rest);
      if (article?.[1]) {
        const found = [...store.articles, all.draftArticle].find((a) => a['id'] === article[1]);
        if (!found) return fail(res, 404, 'not_found', 'no such article');
        return json(res, 200, { data: kalelArticleSchema.parse(found) });
      }

      // ------------------------------------------------------------- taxonomy
      if (rest === '/categories')
        return json(res, 200, { data: store.categories.map((c) => kalelCategorySchema.parse(c)) });
      if (rest === '/tags') {
        const legacy = options.legacyReadsById === true;
        const ids = legacy ? null : idList(q.get('ids'));
        if (ids === 'invalid') return fail(res, 400, 'bad_request', 'ids must list 1 to 200 uuids');
        const slug = legacy ? null : q.get('slug');
        let rows = [...store.tags].sort(
          (a, b) =>
            String(a['name']).localeCompare(String(b['name'])) || String(a['id']).localeCompare(String(b['id'])),
        );
        if (ids) rows = rows.filter((t) => ids.has(String(t['id'])));
        if (slug !== null) rows = rows.filter((t) => t['slug'] === slug);
        if (!legacy && (q.has('limit') || q.has('offset'))) {
          const offset = Math.max(Number(q.get('offset') ?? 0), 0);
          const limit = q.has('limit') ? Math.min(Math.max(Number(q.get('limit')), 1), 1000) : rows.length;
          rows = rows.slice(offset, offset + limit);
        }
        return json(res, 200, { data: rows.map((t) => kalelTagSchema.parse(t)) });
      }
      if (rest === '/authors') return json(res, 200, { data: store.authors.map((a) => kalelAuthorSchema.parse(a)) });
      if (rest === '/entities') return json(res, 200, { data: store.entities.map((e) => kalelEntitySchema.parse(e)) });
      if (rest === '/redirects')
        return json(res, 200, { data: store.redirects.map((r) => kalelRedirectSchema.parse(r)) });

      // ---------------------------------------------------------------- media
      if (rest === '/media/storage') {
        const storage = options.storage ?? { provider: 'local', totalBytes: 2 ** 40, freeBytes: 2 ** 39 };
        if (storage === 'absent') return fail(res, 404, 'not_found', `no route for ${rest}`);
        return json(res, 200, { data: kalelMediaStorageSchema.parse(storage) });
      }

      if (rest === '/media') {
        // Offset, not cursor. Conflating the two truncates the index at the first page,
        // and every cover older than that silently disappears from the site.
        const ids = options.legacyReadsById === true ? null : idList(q.get('ids'));
        if (ids === 'invalid') return fail(res, 400, 'bad_request', 'ids must list 1 to 200 uuids');
        if (ids) {
          const found = store.media.filter((m) => ids.has(String(m['id'])));
          return json(res, 200, { data: kalelMediaListSchema.parse({ items: found, total: found.length }) });
        }
        const limit = Math.min(Math.max(Number(q.get('limit') ?? 60), 1), 200);
        const offset = Math.max(Number(q.get('offset') ?? 0), 0);
        // `q` searches file names, as the API's `ilike '%q%'` does.
        const needle = (q.get('q') ?? '').toLowerCase();
        const pool = needle
          ? store.media.filter((m) => String(m['filename']).toLowerCase().includes(needle))
          : store.media;
        const page = pool.slice(offset, offset + limit);
        return json(res, 200, {
          data: kalelMediaListSchema.parse({ items: page, total: pool.length }),
        });
      }

      const mediaFile = /^\/media\/([0-9a-f-]{36})\/file$/.exec(rest);
      if (mediaFile?.[1]) {
        const row = store.media.find((m) => m['id'] === mediaFile[1]);
        if (!row) return fail(res, 404, 'not_found', 'no such media');
        res.writeHead(200, { 'content-type': String(row['mimeType']), 'content-length': JPEG_BYTES.length });
        return res.end(JPEG_BYTES);
      }

      const mediaRow = /^\/media\/([0-9a-f-]{36})$/.exec(rest);
      if (mediaRow?.[1]) {
        const row = store.media.find((m) => m['id'] === mediaRow[1]);
        if (!row) return fail(res, 404, 'not_found', 'no such media');
        return json(res, 200, { data: kalelMediaSchema.parse(row) });
      }

      return fail(res, 404, 'not_found', `no route for ${rest}`);
    } catch (err) {
      // A response that does not satisfy the application's own schema is a bug in this
      // fake, and saying so beats letting the app fail with a vague parse error.
      return fail(res, 500, 'fake_contract_violation', err instanceof Error ? err.message : String(err));
    }
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return {
    url: `http://127.0.0.1:${boundPort}`,
    requests,
    contents: () => ({
      articles: store.articles,
      media: store.media,
      categories: store.categories,
      tags: store.tags,
      authors: store.authors,
    }),
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

/** The capability token the fake accepts, derived so a test can mint the same one. */
export function previewTokenFor(slug: string): string {
  const payload = Buffer.from(JSON.stringify({ s: slug })).toString('base64url');
  const mac = createHmac('sha256', 'fake-cms-session-secret').update(payload).digest('hex').slice(0, 32);
  return `kpv.${payload}.${mac}`;
}
