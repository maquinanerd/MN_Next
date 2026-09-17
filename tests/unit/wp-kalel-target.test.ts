import { describe, expect, it } from 'vitest';

import { retryAfterMs } from '../../scripts/wp/cli';
import {
  ESTIMATED_BYTES_PER_IMAGE,
  describeUploads,
  estimateNeed,
  storageVerdict,
  tallyUploads,
  type StorageAnswer,
} from '../../scripts/wp/storage';
import { KalElTarget, mediaIdempotencyKey, multipartFile } from '../../scripts/wp/target';

/**
 * The importer's side of the Kal El contract.
 *
 * Every case here is a place where the stand-in used to be more forgiving than the CMS:
 * it read `externalKey` from a form field Kal El never looks at, accepted an
 * `Idempotency-Key` Kal El answers 400 to, and never said 429. An import rehearsed only
 * against that fake would have failed on its first real upload.
 */

const SITE = '11111111-2222-4333-8444-555566667777';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function target(respond: (call: Call, n: number) => Response, sleeps: number[] = [], calls: Call[] = []) {
  return new KalElTarget({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.test',
    siteId: SITE,
    maxRateLimitRetries: 3,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    fetchImpl: (async (input: string | URL, init?: RequestInit) => {
      const call = {
        method: init?.method ?? 'GET',
        url: String(input),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body,
      };
      calls.push(call);
      return respond(call, calls.length);
    }) as unknown as typeof fetch,
  });
}

const ok = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });

describe('uploads speak the CMS’s dialect', () => {
  it('names externalKey in the query string, where Kal El reads it', async () => {
    const calls: Call[] = [];
    const t = target(() => ok({ id: 'm1' }, 201), [], calls);
    await t.uploadMedia('capa.jpg', JPEG, 'image/jpeg', 'wp:media:12');
    expect(calls[0]?.method).toBe('POST');
    expect(new URL(calls[0]?.url ?? '').searchParams.get('externalKey')).toBe('wp:media:12');
  });

  it('sends an Idempotency-Key Kal El accepts, bound to the bytes it travels with', async () => {
    const calls: Call[] = [];
    const t = target(() => ok({ id: 'm1' }, 201), [], calls);
    await t.uploadMedia('capa.jpg', JPEG, 'image/jpeg', 'wp:external:0123456789abcdef0123456789abcdef');
    const key = calls[0]?.headers['idempotency-key'] ?? '';
    // packages/contracts/src/common.ts: idempotencyKeySchema.
    expect(key).toMatch(/^[A-Za-z0-9._-]{8,128}$/);
    expect(mediaIdempotencyKey('wp:media:12', JPEG)).toBe(mediaIdempotencyKey('wp:media:12', JPEG));
    // The same key with other bytes would be refused as a replay; other bytes get another key.
    expect(mediaIdempotencyKey('wp:media:12', Buffer.concat([JPEG, Buffer.from([1])]))).not.toBe(
      mediaIdempotencyKey('wp:media:12', JPEG),
    );
  });
});

/**
 * The upload body.
 *
 * `FormData` + `Blob` sends the same request and keeps a copy of every file in memory that
 * V8 never counts, so nothing collects it: the production run of the archive was holding
 * 6,6 GB after 26.960 images. The body is a Buffer now, and the point of these tests is
 * that the *bytes* did not change with it — Kal El's multipart parser is what accepts or
 * rejects this, and it does not get a rehearsal.
 */
describe('the file travels as bytes, not as a Blob', () => {
  it('serialises exactly what FormData would have, boundary aside', async () => {
    // Quotes, a line break and an accent: the three things a form-data name escapes.
    const filename = 'capa "nova"\r\nmaçã.jpg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(JPEG)], { type: 'image/jpeg' }), filename);
    const reference = new Request('https://cms.example.com/media', { method: 'POST', body: form });
    const referenceType = reference.headers.get('content-type') ?? '';
    const boundary = /boundary=(.+)$/.exec(referenceType)?.[1] ?? '';
    expect(boundary).not.toBe('');

    const { body, contentType } = multipartFile('file', filename, 'image/jpeg', JPEG, boundary);
    expect(contentType).toBe(referenceType);
    expect(body.equals(Buffer.from(await reference.arrayBuffer()))).toBe(true);
  });

  it('uploads one multipart body carrying the file bytes', async () => {
    const calls: Call[] = [];
    const t = target(() => ok({ id: 'm1' }, 201), [], calls);
    await t.uploadMedia('capa.jpg', JPEG, 'image/jpeg', 'wp:media:12');

    const call = calls[0];
    expect(call?.headers['content-type']).toMatch(/^multipart\/form-data; boundary=----mn-import-[0-9a-f]{32}$/);
    // A Buffer is an ArrayBuffer V8 accounts for; that is the whole fix.
    expect(Buffer.isBuffer(call?.body)).toBe(true);
    const body = call?.body as Buffer;
    expect(body.includes(JPEG)).toBe(true);
    expect(body.toString('utf8', 0, 200)).toContain('filename="capa.jpg"');
  });

  it('sends the same bytes again on a 429 instead of copying the file', async () => {
    const calls: Call[] = [];
    const t = target(
      (_call, n) =>
        n === 1 ? new Response(null, { status: 429, headers: { 'retry-after': '1' } }) : ok({ id: 'm1' }, 201),
      [],
      calls,
    );
    await t.uploadMedia('capa.jpg', JPEG, 'image/jpeg', 'wp:media:12');
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).toBe(calls[0]?.body);
  });
});

describe('429 means wait, not fail', () => {
  it('waits for Retry-After and sends the request again', async () => {
    const sleeps: number[] = [];
    const t = target(
      (_call, n) =>
        n === 1 ? new Response(null, { status: 429, headers: { 'retry-after': '2' } }) : ok({ id: 'c1' }, 201),
      sleeps,
    );
    const res = await t.createTag({ name: 'Marvel', slug: 'marvel' }, 'wp.tag.11.import');
    expect(res).toMatchObject({ status: 201, data: { id: 'c1' }, error: null });
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThan(1500);
    expect(sleeps[0]).toBeLessThanOrEqual(2000);
  });

  it('holds back every other request of the run during the pause, not only the one refused', async () => {
    const sleeps: number[] = [];
    const t = target(
      (call) =>
        call.url.endsWith('/tags') && sleeps.length === 0
          ? new Response(null, { status: 429, headers: { 'retry-after': '30' } })
          : ok([]),
      sleeps,
    );
    await t.listTags();
    // A different endpoint, asked after the refusal: it waits too, instead of spending the
    // next window's budget on a refusal of its own.
    await t.listAuthors();
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThan(25_000);
  });

  it('retries a PATCH on 429, which was refused before any handler ran', async () => {
    const t = target((_call, n) => (n === 1 ? new Response(null, { status: 429 }) : ok({ id: 'a1', version: 3 })));
    const res = await t.updateArticle('a1', { title: 'x' }, 2);
    expect(res.data).toEqual({ id: 'a1', version: 3 });
  });

  it('gives up after a bounded number of refusals and reports them', async () => {
    const sleeps: number[] = [];
    const t = target(() => new Response(null, { status: 429, headers: { 'retry-after': '1' } }), sleeps);
    const res = await t.createTag({ name: 'x', slug: 'x' }, 'wp.tag.1.import');
    expect(res).toMatchObject({ status: 429, data: null, error: 'HTTP 429' });
    expect(sleeps.length).toBeLessThanOrEqual(3);
  });

  it('reads Retry-After as seconds or as a date, and never waits unboundedly', () => {
    const now = Date.parse('2026-09-16T12:00:00Z');
    expect(retryAfterMs('5', now)).toBe(5000);
    expect(retryAfterMs('Wed, 16 Sep 2026 12:00:10 GMT', now)).toBe(10_000);
    expect(retryAfterMs(null, now)).toBe(1000);
    expect(retryAfterMs('soon', now)).toBe(1000);
    expect(retryAfterMs('86400', now)).toBe(300_000);
  });
});

describe('the media index is read whole, or not at all', () => {
  it('pages past the 40.000 rows the walk used to stop at', async () => {
    const total = 40_600;
    const t = target((call) => {
      const offset = Number(new URL(call.url).searchParams.get('offset'));
      const items = Array.from({ length: Math.min(200, total - offset) }, (_, i) => ({
        id: `m${offset + i}`,
        externalKey: `wp:media:${offset + i}`,
      }));
      return ok({ items, total });
    });
    const index = await t.mediaIndexByExternalKey();
    expect(index.size).toBe(total);
    expect(index.get('wp:media:40599')).toBe('m40599');
  });

  it('refuses to return a partial index when a page fails', async () => {
    const t = target((call) =>
      new URL(call.url).searchParams.get('offset') === '200'
        ? new Response(JSON.stringify({ error: { code: 'internal_error' } }), { status: 500 })
        : ok({ items: Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, externalKey: `k${i}` })), total: 600 }),
    );
    // "Could not read" is not "not there": a short index re-sends everything past the gap.
    await expect(t.mediaIndexByExternalKey()).rejects.toThrow(/offset 200/);
  });
});

describe('reading storage', () => {
  it('parses what the endpoint answers', async () => {
    const t = target(() => ok({ provider: 'local', totalBytes: 1000, freeBytes: 400 }));
    expect(await t.mediaStorage()).toEqual({
      status: 200,
      data: { provider: 'local', totalBytes: 1000, freeBytes: 400 },
      error: null,
    });
  });

  it('reports a 404 and an unexpected shape instead of inventing a number', async () => {
    const missing = target(() => new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 }));
    expect(await missing.mediaStorage()).toMatchObject({ status: 404, data: null });
    const odd = target(() => ok({ free: 'lots' }));
    expect(await odd.mediaStorage()).toMatchObject({ data: null, error: 'unexpected storage response' });
  });
});

describe('the storage decision', () => {
  const GB = 1024 ** 3;
  const answer = (freeBytes: number | null, status = 200): StorageAnswer => ({
    status,
    data: { provider: 'local', totalBytes: 500 * GB, freeBytes },
    error: null,
  });

  it('estimates measured files as they are and everything else conservatively', () => {
    const need = estimateNeed([1000, null, 0, 3000], 2);
    expect(need).toEqual({
      libraryAssets: 4,
      libraryMeasured: 3,
      libraryBytes: 4000 + ESTIMATED_BYTES_PER_IMAGE,
      externalImages: 2,
      externalBytes: 2 * ESTIMATED_BYTES_PER_IMAGE,
      totalBytes: 4000 + 3 * ESTIMATED_BYTES_PER_IMAGE,
    });
  });

  it('permits an import with its need and a quarter to spare', () => {
    const need = estimateNeed([80 * GB], 0);
    const verdict = storageVerdict(need, answer(100 * GB));
    expect(verdict.ok).toBe(true);
    // The numbers are printed, whichever way it goes.
    expect(verdict.message).toContain('100.0 GB free');
  });

  it('refuses when free space is under the need times 1.25', () => {
    const need = estimateNeed([81 * GB], 0);
    expect(storageVerdict(need, answer(100 * GB))).toMatchObject({ ok: false });
    expect(storageVerdict(need, answer(100 * GB)).message).toMatch(/not enough room/);
  });

  it('refuses an instance that cannot say — too old, without the scope, or with a provider that does not know', () => {
    const need = estimateNeed([GB], 0);
    const tooOld = storageVerdict(need, { status: 404, data: null, error: 'not_found' });
    expect(tooOld).toMatchObject({ ok: false });
    expect(tooOld.message).toContain('--skip-storage-check');
    expect(storageVerdict(need, { status: 403, data: null, error: 'forbidden' }).message).toContain('media.manage');
    expect(storageVerdict(need, answer(null))).toMatchObject({ ok: false });
    expect(storageVerdict(need, { status: 0, data: null, error: 'ECONNREFUSED' })).toMatchObject({ ok: false });
  });

  it('has nothing to check when nothing is left to upload', () => {
    expect(storageVerdict(estimateNeed([], 0), { status: 404, data: null, error: 'not_found' })).toMatchObject({
      ok: true,
    });
  });
});

describe('what the uploads directory holds', () => {
  const url = (id: number): string => `https://www.exemplo.com.br/wp-content/uploads/2025/07/${id}.jpg`;

  it('counts found, missing and over the cap, and estimates only what it could not measure', () => {
    const { sizes, uploads } = tallyUploads(
      [
        { id: 30, url: url(30), size: 2000 },
        { id: 12, url: url(12), size: 0 },
        { id: 7, url: url(7), size: 0 },
        { id: 40, url: url(40), size: 5000 },
      ],
      4096,
    );
    expect(sizes).toEqual([2000, 0, 0, 0]);
    expect(uploads).toEqual({
      found: 1,
      foundBytes: 2000,
      missing: 2,
      overCap: 1,
      // Lowest id first, whatever order the lanes measured them in.
      missingSamples: [
        { id: 7, url: url(7) },
        { id: 12, url: url(12) },
      ],
    });
    expect(describeUploads(uploads, 4)).toBe('1 of 4 library files on disk (2.0 KB); 2 missing, 1 over --max-asset-mb');
  });

  it('says it does not know rather than calling every file missing', () => {
    // An archive run without --uploads measures nothing: the files are not missing, unseen.
    const { sizes, uploads } = tallyUploads([{ id: 1, url: url(1), size: null }], 4096);
    expect(sizes).toEqual([null]);
    expect(uploads).toBeNull();
    expect(describeUploads(uploads, 1)).toContain('not checked');
  });
});
