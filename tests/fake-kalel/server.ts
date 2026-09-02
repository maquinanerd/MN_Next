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
 *     by opaque cursor; media pages by `limit`/`offset` and reports `total`. Those are
 *     two different models in one API, and the whole point of running against this is to
 *     catch code that assumes one.
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

/** A one-pixel JPEG, so the media proxy has real bytes with a real magic number. */
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/**
 * Cursor pagination, opaque to the caller.
 *
 * Base64 of an offset rather than the offset itself: the application must not be able to
 * do arithmetic on it, because against the real CMS it cannot.
 */
const encodeCursor = (offset: number): string => Buffer.from(`o:${offset}`).toString('base64url');
const decodeCursor = (cursor: string | undefined): number => {
  if (!cursor) return 0;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const n = /^o:(\d+)$/.exec(raw);
  return n?.[1] ? Number(n[1]) : 0;
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
        // The real service orders by updatedAt DESC, id DESC.
        items = [...items].sort((a, b) => String(b['updatedAt']).localeCompare(String(a['updatedAt'])));

        const limit = Math.min(Math.max(Number(q.get('limit') ?? 25), 1), 100);
        const offset = decodeCursor(q.get('cursor') ?? undefined);
        const page = items.slice(offset, offset + limit);
        const next = offset + limit < items.length ? encodeCursor(offset + limit) : null;

        return json(res, 200, {
          data: kalelArticleListSchema.parse({ items: page.map(summarise), nextCursor: next }),
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
      if (rest === '/tags') return json(res, 200, { data: store.tags.map((t) => kalelTagSchema.parse(t)) });
      if (rest === '/authors') return json(res, 200, { data: store.authors.map((a) => kalelAuthorSchema.parse(a)) });
      if (rest === '/entities') return json(res, 200, { data: store.entities.map((e) => kalelEntitySchema.parse(e)) });
      if (rest === '/redirects')
        return json(res, 200, { data: store.redirects.map((r) => kalelRedirectSchema.parse(r)) });

      // ---------------------------------------------------------------- media
      if (rest === '/media') {
        // Offset, not cursor. Conflating the two truncates the index at the first page,
        // and every cover older than that silently disappears from the site.
        const limit = Math.min(Math.max(Number(q.get('limit') ?? 60), 1), 200);
        const offset = Math.max(Number(q.get('offset') ?? 0), 0);
        const page = store.media.slice(offset, offset + limit);
        return json(res, 200, {
          data: kalelMediaListSchema.parse({ items: page, total: store.media.length }),
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
