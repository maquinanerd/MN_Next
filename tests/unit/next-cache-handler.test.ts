import { readFileSync } from 'node:fs';
import path from 'node:path';

import FileSystemCache from 'next/dist/server/lib/incremental-cache/file-system-cache';
import { executeRevalidates } from 'next/dist/server/revalidation-utils';
import { initializeCacheHandlers } from 'next/dist/server/use-cache/handlers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MemoryOnlyCache from '../../next-cache-handler.mjs';

/**
 * Nothing but optimized images may be written inside the running container.
 *
 * On 28/09/2026 the portal's container held hundreds of thousands of cache files after a
 * few days of crawling — pages under `.next/server/app`, fetches under
 * `.next/cache/fetch-cache` —, Docker could not remove it inside Coolify's 60-second
 * window, and every deploy from 25/09 on failed at the container swap. The last one left
 * the site answering 503 for three hours.
 *
 * These tests pin the three pieces of the fix: the cache handler keeps pages and fetches
 * in memory and still serves what the build prerendered, next.config wires it with a larger LRU, and the
 * compose file gives the image cache — the one thing still on disk — its own volume.
 */

const SERVER_DIST_DIR = path.join('/app', '.next', 'server');
const LAST_BUILD = new Date('2026-09-28T12:00:00Z');

function fakeFs(files: Record<string, string> = {}) {
  const writes: string[] = [];
  const missing = (file: string) => Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
  return {
    writes,
    fs: {
      readFile: vi.fn(async (file: string) => {
        if (file in files) return files[file];
        throw missing(file);
      }),
      writeFile: vi.fn(async (file: string) => {
        writes.push(file);
      }),
      mkdir: vi.fn(async () => undefined),
      stat: vi.fn(async (file: string) => {
        if (file in files) return { mtime: LAST_BUILD };
        throw missing(file);
      }),
    },
  };
}

function cache(files: Record<string, string> = {}) {
  const disk = fakeFs(files);
  const instance = new MemoryOnlyCache({
    fs: disk.fs,
    flushToDisk: true,
    serverDistDir: SERVER_DIST_DIR,
    revalidatedTags: [],
    maxMemoryCacheSize: 10 * 1024 * 1024,
    dev: false,
  } as unknown as ConstructorParameters<typeof MemoryOnlyCache>[0]);
  return { instance, writes: disk.writes };
}

// The LRU is static inside Next's FileSystemCache: every key here is unique.
let counter = 0;
const uniqueKey = (base: string) => `${base}-${Date.now()}-${counter++}`;

const PAGE_CTX = { kind: 'APP_PAGE', isRoutePPREnabled: false, isFallback: false } as const;

function renderedPage(html: string) {
  return {
    kind: 'APP_PAGE',
    html,
    rscData: Buffer.from('rsc'),
    headers: {},
    status: 200,
    postponed: undefined,
    segmentData: undefined,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next-cache-handler', () => {
  it('keeps a page rendered at run time in memory and never writes it to disk', async () => {
    const { instance, writes } = cache();
    const key = uniqueKey('/cinema/materia');

    await instance.set(key, renderedPage('<p>renderizada agora</p>') as never, PAGE_CTX as never);
    const entry = await instance.get(key, PAGE_CTX as never);

    expect(writes).toEqual([]);
    expect((entry?.value as { html?: string } | undefined)?.html).toBe('<p>renderizada agora</p>');
  });

  it('keeps a fetch in memory and never writes it to disk', async () => {
    const { instance, writes } = cache();
    const key = uniqueKey('fetch-kalel');

    await instance.set(
      key,
      {
        kind: 'FETCH',
        data: { headers: {}, body: 'e30=', status: 200, url: 'https://cms.example/articles' },
        revalidate: 60,
      } as never,
      { fetchCache: true, tags: ['articles'] } as never,
    );

    expect(writes).toEqual([]);
  });

  it('still serves from disk the pages next build prerendered', async () => {
    const key = uniqueKey('/sobre');
    const file = (suffix: string) => path.join(SERVER_DIST_DIR, 'app', `${key}${suffix}`);
    const { instance } = cache({
      [file('.html')]: '<p>do build</p>',
      [file('.rsc')]: 'rsc',
      [file('.meta')]: JSON.stringify({ headers: {}, status: 200 }),
    });

    const entry = await instance.get(key, PAGE_CTX as never);

    expect((entry?.value as { html?: string } | undefined)?.html).toBe('<p>do build</p>');
  });

  it("writes nothing where Next's own handler writes the page to disk", async () => {
    // The control: the same fake disk, Next's default handler. Without it the assertions
    // above could pass because the fake never records a write.
    const disk = fakeFs();
    const nextDefault = new FileSystemCache({
      fs: disk.fs,
      flushToDisk: true,
      serverDistDir: SERVER_DIST_DIR,
      revalidatedTags: [],
      maxMemoryCacheSize: 10 * 1024 * 1024,
      dev: false,
    } as unknown as ConstructorParameters<typeof FileSystemCache>[0]);
    const { instance, writes } = cache();

    await nextDefault.set(uniqueKey('/cinema/padrao'), renderedPage('<p>x</p>') as never, PAGE_CTX as never);
    await instance.set(uniqueKey('/cinema/nosso'), renderedPage('<p>x</p>') as never, PAGE_CTX as never);

    expect(disk.writes.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });
});

describe('revalidating the same tag again', () => {
  /*
   * The publication webhook revalidates `home` on every delivery, and since the Kal El
   * reads hit the data cache (DECISIONS §7.33) whether the second delivery works decides
   * whether the home shows the second story. In Next 15.5.4 the file-system cache records
   * only the FIRST time a tag is revalidated (`if (!tagsManifest.has(tag))` in
   * `file-system-cache.js`); what moves the date forward on later deliveries is the
   * default `use cache` handler's `expireTags`, which `executeRevalidates` also calls and
   * which writes to the same manifest. This drives that path — the one a route handler's
   * `revalidateTag` ends in — through this repository's handler.
   */
  const FETCH_CTX = (tag: string) => ({ kind: 'FETCH', tags: [tag], softTags: [] }) as never;
  const fetchEntry = {
    kind: 'FETCH',
    data: { headers: {}, body: 'e30=', status: 200, url: 'https://cms.example/articles' },
    revalidate: 60,
  } as never;
  // The manifest keeps `performance.timeOrigin + now()`, an entry `Date.now()`: a margin
  // well above any drift between the two clocks.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 40));

  it('is wired in production: Next starts the default handlers unless the config removes them', async () => {
    // `next start` calls `initializeCacheHandlers` only when `experimental.cacheHandlers`
    // is set (`next-server.js`), and that is true by default. Neither the project config
    // nor a Next upgrade may take it away without the second delivery going stale.
    const { defaultConfig } = await import('next/dist/server/config-shared');
    const { default: config } = await import('../../next.config');
    expect(typeof defaultConfig.experimental?.cacheHandlers).toBe('object');
    expect(config.experimental?.cacheHandlers).toBeUndefined();
  });

  it('invalidates what was cached after the first delivery', async () => {
    initializeCacheHandlers();
    const { instance } = cache();
    const tag = uniqueKey('home');
    const key = uniqueKey('fetch-home');
    const deliver = () =>
      executeRevalidates({ incrementalCache: instance } as never, {
        pendingRevalidatedTags: [tag],
        pendingRevalidates: {},
        pendingRevalidateWrites: [],
      });

    await instance.set(key, fetchEntry, { fetchCache: true, tags: [tag] } as never);
    await tick();
    await deliver();
    expect(await instance.get(key, FETCH_CTX(tag))).toBeNull();

    // The next render stores the fresh answer; it must be served until the next delivery.
    await tick();
    await instance.set(key, fetchEntry, { fetchCache: true, tags: [tag] } as never);
    expect(await instance.get(key, FETCH_CTX(tag))).not.toBeNull();

    await tick();
    await deliver();
    expect(await instance.get(key, FETCH_CTX(tag))).toBeNull();
  });
});

describe('wiring', () => {
  it('next.config uses the handler with a 256 MB LRU', async () => {
    const { default: config } = await import('../../next.config');

    expect(config.cacheHandler).toBe(path.join(process.cwd(), 'next-cache-handler.mjs'));
    expect(config.cacheMaxMemorySize).toBe(256 * 1024 * 1024);
  });

  it('gives the image cache, and only the image cache, a volume on Coolify', () => {
    const compose = readFileSync(path.join(process.cwd(), 'docker-compose.coolify.yml'), 'utf8');
    const mounts = [...compose.matchAll(/^\s+- ([\w-]+):(\/app\/\S+)$/gm)].map((m) => `${m[1]}:${m[2]}`);

    expect(mounts).toEqual(['portal-image-cache:/app/.next/cache/images']);
    expect(compose).toMatch(/^volumes:\n {2}portal-image-cache:/m);
  });

  it('creates the image cache directory as the server user before the volume covers it', () => {
    const dockerfile = readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
    const runner = dockerfile.slice(dockerfile.indexOf('AS runner'));

    expect(runner.indexOf('USER nextjs')).toBeLessThan(runner.indexOf('RUN mkdir -p .next/cache/images'));
  });
});
