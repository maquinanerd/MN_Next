import { describe, expect, it } from 'vitest';

import type { Image } from '@mn/content';

import { Counter, type RunSummary } from '../../scripts/wp/cli';
import {
  IMPORTER_USER_AGENT,
  externalImageDownloader,
  externalImageHash,
  externalImageKey,
  importExternalImages,
  type ExternalImage,
  type ExternalImageDeps,
  type ExternalImageOutcome,
} from '../../scripts/wp/external-images';
import { exitCodeFor } from '../../scripts/wp/import';
import type { GuardedFetchResult } from '../../scripts/wp/source';
import { emptyState, mappingKey, type RunState } from '../../scripts/wp/state';

/**
 * Third-party images, from download to the index a post is converted against.
 *
 * Two halves. The download is the SSRF-guarded fetch the media library already uses,
 * pointed this time at hosts that come out of post bodies — so the guard is exercised
 * against exactly the tricks such a URL can play. The import is the accounting: a host's
 * failure must never read as the import's, and the import's must never read as success.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PUBLIC = async (): Promise<string[]> => ['203.0.113.10'];

function image(url: string, over: Partial<ExternalImage> = {}): ExternalImage {
  const hash = externalImageHash(url);
  return {
    url,
    host: new URL(url).hostname,
    hash,
    externalKey: externalImageKey(hash),
    srcs: [url],
    alt: 'Uma cena',
    occurrences: 1,
    firstPostId: 1,
    ...over,
  };
}

type FetchCall = { url: string; headers: Record<string, string> };

function fakeFetch(respond: (url: string) => Response, calls: FetchCall[] = []): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return respond(String(input));
  }) as unknown as typeof fetch;
}

describe('the download is guarded like the media library, against hosts out of post bodies', () => {
  const allowed = new Set(['cdn.test', 'outro-cdn.test']);

  it('downloads from a public host the collection found, and says who is asking', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(
        () => new Response(new Uint8Array(JPEG), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
        calls,
      ),
    });
    const result = await download(image('https://cdn.test/a.jpg?w=1100'));
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe('https://cdn.test/a.jpg?w=1100');
    expect(calls[0]?.headers['user-agent']).toBe(IMPORTER_USER_AGENT);
    expect(calls[0]?.headers.accept).not.toContain('svg');
  });

  it('refuses a host whose name resolves to a private address, before any request', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: async () => ['10.0.0.5'],
      fetchImpl: fakeFetch(() => new Response(null, { status: 200 }), calls),
    });
    expect(await download(image('https://cdn.test/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'not allowed: private address',
    });
    expect(calls).toEqual([]);
  });

  it('refuses a redirect to the cloud metadata address, and never follows it', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      // Allowlisted on purpose, so what refuses the hop is the address check, not the list.
      allowedHosts: new Set([...allowed, '169.254.169.254']),
      maxBytes: 1024,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(
        () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } }),
        calls,
      ),
    });
    const result = await download(image('https://cdn.test/a.jpg'));
    expect(result).toMatchObject({ ok: false, reason: 'redirect not allowed: private address' });
    expect(calls).toHaveLength(1);
  });

  it('refuses a redirect to a host the collection never found', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(
        () => new Response(null, { status: 302, headers: { location: 'https://intruso.test/a.jpg' } }),
        calls,
      ),
    });
    expect(await download(image('https://cdn.test/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'redirect not allowed: host',
    });
    expect(calls).toHaveLength(1);
  });

  it('refuses a redirect hop whose allowlisted name resolves privately', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: async (host) => (host === 'outro-cdn.test' ? ['127.0.0.1'] : ['203.0.113.10']),
      fetchImpl: fakeFetch(
        () => new Response(null, { status: 301, headers: { location: 'https://outro-cdn.test/a.jpg' } }),
        calls,
      ),
    });
    expect(await download(image('https://cdn.test/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'redirect not allowed: private address',
    });
    expect(calls).toHaveLength(1);
  });

  it('refuses a host the collection never found', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(() => new Response(null, { status: 200 }), calls),
    });
    expect(await download(image('https://intruso.test/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'not allowed: host',
    });
    expect(calls).toEqual([]);
  });

  it('refuses a body over the cap even when the header claims it is small', async () => {
    const download = externalImageDownloader({
      allowedHosts: allowed,
      maxBytes: 1024,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(
        () =>
          new Response(new Uint8Array(4096), {
            status: 200,
            headers: { 'content-type': 'image/jpeg', 'content-length': '10' },
          }),
      ),
    });
    expect(await download(image('https://cdn.test/a.jpg'))).toMatchObject({ ok: false, reason: 'too large' });
  });

  it('lets the rehearsal flag reach this machine and nothing else on the network', async () => {
    const hosts = new Set(['localhost', '10.0.0.5']);
    const download = externalImageDownloader({
      allowedHosts: hosts,
      maxBytes: 1024,
      allowLoopbackHosts: true,
      lookupImpl: PUBLIC,
      fetchImpl: fakeFetch(() => new Response(new Uint8Array(JPEG), { status: 200 })),
    });
    expect((await download(image('http://localhost:8080/a.jpg'))).ok).toBe(true);
    // Allowlisted, private, and still refused: the flag relaxes loopback only.
    expect(await download(image('http://10.0.0.5/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'not allowed: private address',
    });
  });

  it('does not relax a name that is not loopback but resolves into the network', async () => {
    const calls: FetchCall[] = [];
    const download = externalImageDownloader({
      allowedHosts: new Set(['intranet.test']),
      maxBytes: 1024,
      allowLoopbackHosts: true,
      lookupImpl: async () => ['10.0.0.5'],
      fetchImpl: fakeFetch(() => new Response(new Uint8Array(JPEG), { status: 200 }), calls),
    });
    expect(await download(image('https://intranet.test/a.jpg'))).toMatchObject({
      ok: false,
      reason: 'not allowed: private address',
    });
    expect(calls).toEqual([]);
  });
});

interface Harness {
  deps: ExternalImageDeps;
  state: RunState;
  summary: RunSummary;
  imageByUrl: Map<string, Image>;
  outcomes: ExternalImageOutcome[];
  uploads: string[];
  metadata: { id: string; body: Record<string, unknown> }[];
  downloads: string[];
  sleeps: number[];
  checkpoints: number;
}

function harness(
  over: Partial<ExternalImageDeps> & { respond?: (image: ExternalImage) => GuardedFetchResult } = {},
  state: RunState = emptyState('2026-01-01T00:00:00.000Z'),
): Harness {
  const summary: RunSummary = {
    tool: 'wp:import',
    runId: state.runId,
    applied: true,
    counts: new Counter(),
    failures: [],
    artefacts: [],
  };
  const h: Harness = {
    state,
    summary,
    imageByUrl: new Map(),
    outcomes: [],
    uploads: [],
    metadata: [],
    downloads: [],
    sleeps: [],
    checkpoints: 0,
    deps: undefined as unknown as ExternalImageDeps,
  };
  const { respond, ...rest } = over;
  h.deps = {
    target: {
      uploadMedia: async (_filename, _data, _type, externalKey) => {
        h.uploads.push(externalKey);
        return { status: 201, id: `media-${h.uploads.length}`, error: null };
      },
      updateMediaMetadata: async (id, body) => {
        h.metadata.push({ id, body });
        return { status: 200, data: { id }, error: null };
      },
    },
    imageByUrl: h.imageByUrl,
    state,
    summary,
    alreadyImported: new Map(),
    download: async (img) => {
      h.downloads.push(img.url);
      return respond ? respond(img) : { ok: true, data: JPEG, mimeType: 'image/jpeg' };
    },
    concurrency: 2,
    downloads: 4,
    perHost: 2,
    checkpoint: async () => {
      h.checkpoints += 1;
    },
    sleep: async (ms) => {
      h.sleeps.push(ms);
    },
    record: (outcome) => h.outcomes.push(outcome),
    ...rest,
  };
  return h;
}

describe('a hosted image resolves like any other', () => {
  it('uploads once, registers every spelling, and credits the host', async () => {
    const h = harness();
    const one = image('https://cdn.test/a.jpg?w=1100&q=80', {
      srcs: ['https://cdn.test/a.jpg?w=1100&amp;#038;q=80', 'https://cdn.test/a.jpg?w=1100&amp;q=80'],
    });
    await importExternalImages([one], h.deps);

    expect(h.uploads).toEqual([one.externalKey]);
    for (const src of one.srcs) expect(h.imageByUrl.get(src)?.url).toBe('/media/media-1');
    expect(h.metadata).toEqual([{ id: 'media-1', body: { altText: 'Uma cena', credit: 'Imagem: cdn.test' } }]);
    expect(h.state.mappings[mappingKey('external', one.hash)]).toBe('media-1');
    expect(h.outcomes).toEqual([
      expect.objectContaining({ outcome: 'transferred', mediaId: 'media-1', host: 'cdn.test' }),
    ]);
    expect(h.summary.counts.get('externalImagesTransferred')).toBe(1);
  });

  it('writes nothing and downloads nothing in a dry run', async () => {
    const h = harness({ target: null });
    const tallies = await importExternalImages([image('https://cdn.test/a.jpg')], h.deps);
    expect(h.downloads).toEqual([]);
    expect(h.imageByUrl.size).toBe(0);
    expect(h.outcomes).toEqual([expect.objectContaining({ outcome: 'planned' })]);
    expect(tallies.get('cdn.test')).toMatchObject({ uniqueUrls: 1, occurrences: 1 });
  });
});

describe('a host failing is the host’s failure', () => {
  it('drops a 404 from the body without failing the run', async () => {
    const h = harness({ respond: () => ({ ok: false, reason: 'http 404', detail: 'x', status: 404 }) });
    const tallies = await importExternalImages([image('https://cdn.test/sumiu.jpg')], h.deps);

    expect(h.imageByUrl.size).toBe(0);
    expect(h.uploads).toEqual([]);
    expect(h.summary.counts.get('externalImagesFailed')).toBe(1);
    expect(h.summary.counts.get('failed')).toBe(0);
    expect(tallies.get('cdn.test')).toMatchObject({ failed: 1, failures: { 'http 404': 1 } });
    expect(exitCodeFor(true, h.summary)).toBe(0);
  });

  it('refuses bytes that are not a raster image — an HTML page, an SVG — whatever the header said', async () => {
    const html = Buffer.from('<!doctype html><title>Página</title>', 'latin1');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'latin1');
    const h = harness({
      respond: (img) => ({ ok: true, data: img.url.endsWith('.svg') ? svg : html, mimeType: 'image/jpeg' }),
    });
    const tallies = await importExternalImages(
      [image('https://cdn.test/pagina.jpg'), image('https://cdn.test/vetor.svg')],
      h.deps,
    );

    expect(h.uploads).toEqual([]);
    expect(tallies.get('cdn.test')).toMatchObject({ failed: 2, failures: { 'not a raster image': 2 } });
    expect(exitCodeFor(true, h.summary)).toBe(0);
  });

  it('tries once more after a 429 or a 5xx, honouring Retry-After within reason', async () => {
    const attempts = new Map<string, number>();
    const h = harness({
      respond: (img) => {
        const n = (attempts.get(img.url) ?? 0) + 1;
        attempts.set(img.url, n);
        if (img.url.includes('limitado') && n === 1)
          return { ok: false, reason: 'http 429', detail: '', status: 429, retryAfter: '3' };
        if (img.url.includes('instavel') && n === 1)
          return { ok: false, reason: 'http 503', detail: '', status: 503, retryAfter: null };
        if (img.url.includes('sempre'))
          return { ok: false, reason: 'http 500', detail: '', status: 500, retryAfter: '600' };
        if (img.url.includes('sumiu')) return { ok: false, reason: 'http 404', detail: '', status: 404 };
        return { ok: true, data: JPEG, mimeType: 'image/jpeg' };
      },
      downloads: 1,
    });
    await importExternalImages(
      ['limitado', 'instavel', 'sempre', 'sumiu'].map((name) => image(`https://cdn.test/${name}.jpg`)),
      h.deps,
    );

    expect(Object.fromEntries(attempts)).toEqual({
      'https://cdn.test/limitado.jpg': 2,
      'https://cdn.test/instavel.jpg': 2,
      // One retry, not a loop.
      'https://cdn.test/sempre.jpg': 2,
      // A 404 is an answer, not a hiccup.
      'https://cdn.test/sumiu.jpg': 1,
    });
    expect(h.sleeps).toEqual([3000, 2000, 30000]);
    expect(h.summary.counts.get('externalImagesTransferred')).toBe(2);
    expect(h.summary.counts.get('externalImagesFailed')).toBe(2);
  });
});

describe('Kal El failing is the import’s failure', () => {
  it('counts a refused upload as failed, so an apply exits 1', async () => {
    const h = harness();
    h.deps.target = {
      uploadMedia: async () => ({ status: 413, id: null, error: 'PAYLOAD_TOO_LARGE' }),
      updateMediaMetadata: async (id) => ({ status: 200, data: { id }, error: null }),
    };
    const tallies = await importExternalImages([image('https://cdn.test/a.jpg')], h.deps);

    expect(h.summary.counts.get('failed')).toBe(1);
    expect(h.summary.counts.get('externalImagesFailed')).toBe(0);
    expect(tallies.get('cdn.test')).toMatchObject({ failedOnKalEl: 1, failed: 0 });
    expect(h.imageByUrl.size).toBe(0);
    expect(exitCodeFor(true, h.summary)).toBe(1);
  });

  it('treats a thrown upload the same as a refused one', async () => {
    const h = harness();
    h.deps.target = {
      uploadMedia: async () => {
        throw new Error('ECONNRESET');
      },
      updateMediaMetadata: async (id) => ({ status: 200, data: { id }, error: null }),
    };
    await expect(importExternalImages([image('https://cdn.test/a.jpg')], h.deps)).resolves.toBeDefined();
    expect(h.summary.failures[0]?.reason).toContain('ECONNRESET');
    expect(exitCodeFor(true, h.summary)).toBe(1);
  });

  it('remembers metadata that did not land, and pays it back on the next run', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const one = image('https://cdn.test/a.jpg');

    const first = harness({}, state);
    first.deps.target = {
      uploadMedia: async () => ({ status: 201, id: 'media-9', error: null }),
      updateMediaMetadata: async () => ({ status: 503, data: null, error: 'unavailable' }),
    };
    await importExternalImages([one], first.deps);
    expect(state.pendingExternalMeta).toEqual([one.hash]);
    expect(state.mappings[mappingKey('external', one.hash)]).toBeUndefined();
    expect(exitCodeFor(true, first.summary)).toBe(1);

    // The file is in Kal El: the next run finds it by key, does not download it, and
    // writes the metadata it still owes.
    const second = harness({ alreadyImported: new Map([[one.externalKey, 'media-9']]) }, state);
    await importExternalImages([one], second.deps);
    expect(second.downloads).toEqual([]);
    expect(second.metadata).toEqual([{ id: 'media-9', body: { altText: 'Uma cena', credit: 'Imagem: cdn.test' } }]);
    expect(state.pendingExternalMeta).toEqual([]);
    expect(state.mappings[mappingKey('external', one.hash)]).toBe('media-9');
    expect(second.imageByUrl.get(one.url)?.url).toBe('/media/media-9');
  });
});

describe('a re-run reuses instead of downloading again', () => {
  it('reuses from the checkpoint alone, with nothing to write', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const one = image('https://cdn.test/a.jpg');
    state.mappings[mappingKey('external', one.hash)] = 'media-1';

    const h = harness({}, state);
    await importExternalImages([one], h.deps);

    expect(h.downloads).toEqual([]);
    expect(h.uploads).toEqual([]);
    expect(h.metadata).toEqual([]);
    expect(h.imageByUrl.get(one.url)?.url).toBe('/media/media-1');
    expect(h.summary.counts.get('externalImagesReused')).toBe(1);
  });

  it('reuses what Kal El already holds under the key, even with the checkpoint lost', async () => {
    const one = image('https://cdn.test/a.jpg');
    const h = harness({ alreadyImported: new Map([[one.externalKey, 'media-7']]) });
    await importExternalImages([one], h.deps);

    expect(h.downloads).toEqual([]);
    // Nobody knows whether the metadata of the run that uploaded it landed.
    expect(h.metadata.map((m) => m.id)).toEqual(['media-7']);
    expect(h.state.mappings[mappingKey('external', one.hash)]).toBe('media-7');
  });
});

describe('politeness towards the hosts', () => {
  it('never holds more than the per-host and global limits, and does not park small hosts behind a big one', async () => {
    const active = new Map<string, number>();
    const peak = new Map<string, number>();
    let global = 0;
    let globalPeak = 0;
    const order: string[] = [];
    const h = harness({
      perHost: 2,
      downloads: 3,
      concurrency: 2,
      download: async (img) => {
        global += 1;
        globalPeak = Math.max(globalPeak, global);
        active.set(img.host, (active.get(img.host) ?? 0) + 1);
        peak.set(img.host, Math.max(peak.get(img.host) ?? 0, active.get(img.host) ?? 0));
        order.push(img.host);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active.set(img.host, (active.get(img.host) ?? 1) - 1);
        global -= 1;
        return { ok: true, data: JPEG, mimeType: 'image/jpeg' };
      },
    });
    const images = [
      ...Array.from({ length: 12 }, (_, i) => image(`https://grande.test/${i}.jpg`)),
      image('https://pequeno.test/0.jpg'),
      image('https://pequeno.test/1.jpg'),
    ];
    await importExternalImages(images, h.deps);

    expect(peak.get('grande.test')).toBeLessThanOrEqual(2);
    expect(globalPeak).toBeLessThanOrEqual(3);
    expect(h.uploads).toHaveLength(14);
    // Round-robin: the small host starts among the first downloads, not after the twelve.
    expect(order.indexOf('pequeno.test')).toBeLessThan(3);
  });

  it('saves the checkpoint as transfers accumulate, not only at the end', async () => {
    const h = harness({ checkpointEvery: 5 });
    await importExternalImages(
      Array.from({ length: 12 }, (_, i) => image(`https://cdn.test/${i}.jpg`)),
      h.deps,
    );
    expect(h.checkpoints).toBe(2);
  });
});
