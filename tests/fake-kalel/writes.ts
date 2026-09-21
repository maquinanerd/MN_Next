import type { IncomingMessage, ServerResponse } from 'node:http';

import { SITE_ID, type Row } from './corpus';

/**
 * The write half of the stand-in CMS.
 *
 * Separate from the read half because the two have different jobs. Reads exist so the
 * delivery gate can render pages; writes exist so the **WordPress importer can actually
 * be run**, twice, against something that behaves like the real target — which is the
 * only way its central claim, that a second run updates instead of duplicating, stops
 * being a property of the design and becomes an observation.
 *
 * Four behaviours are modelled because the importer depends on each of them:
 *
 *  - `Idempotency-Key` returns the first result for a repeated step, never a second row —
 *    and, as in Kal El, a key outside `[A-Za-z0-9._-]{8,128}` is a 400. The fake used to
 *    accept any key, which is how an importer whose every upload key contained a colon
 *    passed here while the real CMS would have refused all 73.173 of them.
 *  - `externalKey` is unique per site, so a create for an already-imported item is a 409.
 *  - `If-Match` refuses a PATCH whose version is stale, so an article edited in the CMS
 *    after import survives a re-run instead of being overwritten.
 *  - A media upload names its `externalKey` in the query string, the only place Kal El
 *    reads it from.
 */

/** Kal El's `idempotencyKeySchema` (packages/contracts/src/common.ts). */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Kal El's length limits on a term (packages/contracts/src/editorial.ts).
 *
 * The fake took any length, and the first production session lost 17 tags to the real
 * limit — names past 80 characters that every rehearsal here had accepted.
 */
const TERM_LIMITS: Record<string, { name: number; slug: number }> = {
  categories: { name: 120, slug: 140 },
  tags: { name: 80, slug: 100 },
  authors: { name: 120, slug: 140 },
};

/**
 * The first part of an article past one of Kal El's document limits, or null.
 *
 * A text node's 10.000 characters above all: three posts of the real archive were one
 * paragraph longer than that, and the real CMS refused each whole.
 */
function documentProblem(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = documentProblem(item);
      if (problem) return problem;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const node = value as Record<string, unknown>;
  if (node['type'] === 'text' && typeof node['text'] === 'string' && node['text'].length > 10_000) {
    return 'a text node is over 10000 characters';
  }
  if (node['type'] === 'image') {
    const attrs = (node['attrs'] ?? {}) as Record<string, unknown>;
    const over = (field: string, max: number) => typeof attrs[field] === 'string' && String(attrs[field]).length > max;
    if (over('caption', 2000) || over('credit', 500) || over('altText', 500)) return 'an image field is too long';
  }
  for (const child of Object.values(node)) {
    const problem = documentProblem(child);
    if (problem) return problem;
  }
  return null;
}

/** An article body's first violation of the limits the importer has met, or null. */
function articleProblem(body: Record<string, unknown>): string | null {
  const title = body['title'];
  if (title !== undefined && (typeof title !== 'string' || title.length < 1 || title.length > 400)) return 'title';
  const excerpt = body['excerpt'];
  if (typeof excerpt === 'string' && excerpt.length > 2000) return 'excerpt';
  return documentProblem(body['document']);
}

export interface Store {
  articles: Row[];
  media: Row[];
  categories: Row[];
  tags: Row[];
  authors: Row[];
  entities: Row[];
  redirects: Row[];
}

export interface WriteContext {
  store: Store;
  mint: (kind: number) => string;
  idempotent: Map<string, unknown>;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  fail: (res: ServerResponse, status: number, code: string, message: string) => void;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const TERM_KIND: Record<string, number> = { categories: 0xc0, tags: 0x7a, authors: 0xa0 };

export async function handleWrite(
  ctx: WriteContext,
  req: IncomingMessage,
  res: ServerResponse,
  rest: string,
): Promise<void> {
  const { store, mint, idempotent, json, fail } = ctx;
  const raw = await readBody(req);

  const key = req.headers['idempotency-key'];
  const idem = typeof key === 'string' ? key : null;
  if (idem !== null && !IDEMPOTENCY_KEY.test(idem))
    return fail(res, 400, 'bad_request', 'invalid Idempotency-Key header');
  if (idem && idempotent.has(idem)) return json(res, 200, { data: idempotent.get(idem) });

  const remember = <T>(value: T): T => {
    if (idem) idempotent.set(idem, value);
    return value;
  };

  const asJson = (): Record<string, unknown> => {
    try {
      return JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const now = (): string => new Date().toISOString();

  // ------------------------------------------------------------------ taxonomy
  const term = /^\/(categories|tags|authors)$/.exec(rest);
  if (term?.[1] && req.method === 'POST') {
    const name = term[1] as 'categories' | 'tags' | 'authors';
    const body = asJson();
    const limits = TERM_LIMITS[name];
    const termName = typeof body['name'] === 'string' ? body['name'] : '';
    const termSlug = typeof body['slug'] === 'string' ? body['slug'] : '';
    if (
      limits &&
      (termName.length < 1 || termName.length > limits.name || termSlug.length < 1 || termSlug.length > limits.slug)
    ) {
      return fail(res, 400, 'VALIDATION_ERROR', 'validation failed');
    }
    const collection = store[name];
    // The real CMS deduplicates a term by slug, which is what makes two WordPress terms
    // that slugify the same become one.
    const existing = collection.find((row) => row['slug'] === body['slug']);
    if (existing) return json(res, 200, { data: remember({ id: existing.id }) });

    const row: Row = {
      id: mint(TERM_KIND[name] ?? 0xc0),
      siteId: SITE_ID,
      name: body['name'] ?? body['slug'],
      slug: body['slug'],
      description: body['description'] ?? null,
      parentId: body['parentId'] ?? null,
      bio: body['bio'] ?? null,
      email: null,
      userId: null,
      avatarMediaId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    collection.push(row);
    return json(res, 201, { data: remember({ id: row.id }) });
  }

  // ------------------------------------------------------------------ article
  if (rest === '/articles' && req.method === 'POST') {
    const body = asJson();
    const problem = articleProblem(body);
    if (problem) return fail(res, 400, 'VALIDATION_ERROR', `validation failed: ${problem}`);
    const twin = store.articles.find((a) => a['externalKey'] === body['externalKey']);
    if (twin) return fail(res, 409, 'conflict', 'externalKey already exists');

    // The CMS fills in the columns a create omits. Without these defaults the row it
    // stores does not satisfy the article schema, every later read of it is a 500, and
    // the importer reads that as "no such article" — so a second run tries to create it
    // again. The fake has to be as generous as the real database is, or it manufactures
    // an idempotence failure that does not exist.
    const row: Row = {
      type: 'article',
      dek: null,
      excerpt: null,
      slug: null,
      externalKey: null,
      featuredMediaId: null,
      authors: [],
      categories: [],
      tags: [],
      entities: [],
      publishedAt: null,
      scheduledAt: null,
      qualityFlags: [],
      document: { version: 2, nodes: [] },
      seo: null,
      provenance: null,
      workflowNote: null,
      ...body,
      id: mint(0xf0),
      siteId: SITE_ID,
      version: 1,
      status: body['status'] ?? 'draft',
      createdAt: now(),
      updatedAt: now(),
    };
    store.articles.push(row);
    return json(res, 201, { data: remember({ id: row.id, version: 1 }) });
  }

  const patch = /^\/articles\/([0-9a-f-]{36})$/.exec(rest);
  if (patch?.[1] && req.method === 'PATCH') {
    const row = store.articles.find((a) => a['id'] === patch[1]);
    if (!row) return fail(res, 404, 'not_found', 'no such article');

    const ifMatch = req.headers['if-match'];
    if (typeof ifMatch === 'string' && Number(ifMatch) !== Number(row['version'])) {
      // Someone edited it in the CMS since the importer read it. Refusing is the point:
      // overwriting an editorial change with a re-import is worse than skipping it.
      return fail(res, 409, 'version_conflict', 'the article changed since it was read');
    }

    const body = asJson();
    const problem = articleProblem(body);
    if (problem) return fail(res, 400, 'VALIDATION_ERROR', `validation failed: ${problem}`);
    Object.assign(row, body, { version: Number(row['version']) + 1, updatedAt: now() });
    return json(res, 200, { data: { id: row['id'], version: row['version'] } });
  }

  // A tag renamed in place, as `PATCH /tags/:id` does; the importer repairs its own names so.
  const tagPatch = /^\/tags\/([0-9a-f-]{36})$/.exec(rest);
  if (tagPatch?.[1] && req.method === 'PATCH') {
    const row = store.tags.find((t) => t['id'] === tagPatch[1]);
    if (!row) return fail(res, 404, 'not_found', 'tag not found');
    const body = asJson();
    const limits = TERM_LIMITS['tags'] as { name: number; slug: number };
    const nextName = body['name'];
    if (
      nextName !== undefined &&
      (typeof nextName !== 'string' || nextName.length < 1 || nextName.length > limits.name)
    ) {
      return fail(res, 400, 'VALIDATION_ERROR', 'validation failed');
    }
    if (typeof nextName === 'string') row['name'] = nextName;
    row['updatedAt'] = now();
    return json(res, 200, { data: { id: row['id'], name: row['name'], slug: row['slug'] } });
  }

  // -------------------------------------------------------------------- media
  if (rest === '/media' && req.method === 'POST') {
    // The query string, as in Kal El (apps/api/src/routes/site.ts). A form field of the
    // same name is ignored there, and so it is here.
    const externalKey = new URL(req.url ?? '/', 'http://fake.local').searchParams.get('externalKey') || null;

    const twin = externalKey ? store.media.find((m) => m['externalKey'] === externalKey) : undefined;
    if (twin) return json(res, 200, { data: remember({ id: twin.id }) });

    const row: Row = {
      id: mint(0x0d),
      siteId: SITE_ID,
      filename: /filename="([^"]*)"/.exec(raw.toString('latin1'))?.[1] ?? 'uploaded.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: raw.length,
      width: 1600,
      height: 900,
      altText: null,
      caption: null,
      credit: null,
      focalX: null,
      focalY: null,
      storageKey: `fake/${externalKey ?? 'anon'}`,
      provider: 'fake',
      createdBy: null,
      externalKey,
      createdAt: now(),
      updatedAt: now(),
    };
    store.media.push(row);
    return json(res, 201, { data: remember({ id: row.id }) });
  }

  const mediaPatch = /^\/media\/([0-9a-f-]{36})$/.exec(rest);
  if (mediaPatch?.[1] && req.method === 'PATCH') {
    const row = store.media.find((m) => m['id'] === mediaPatch[1]);
    if (!row) return fail(res, 404, 'not_found', 'no such media');
    Object.assign(row, asJson(), { updatedAt: now() });
    return json(res, 200, { data: { id: row['id'] } });
  }

  // ---------------------------------------------------------------- redirects
  if (rest === '/redirects' && req.method === 'POST') {
    const row: Row = { id: mint(0x4e), siteId: SITE_ID, ...asJson(), createdAt: now() };
    store.redirects.push(row);
    return json(res, 201, { data: remember({ id: row.id }) });
  }

  return fail(res, 404, 'not_found', `no write route for ${String(req.method)} ${rest}`);
}
