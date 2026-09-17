import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVICE_TOKEN, SITE_ID, type Row } from '../fake-kalel/corpus';
import { startFakeKalEl, type FakeKalEl } from '../fake-kalel/server';
import { startFakeWordPress, type FakeWordPress } from '../fake-wp/server';

const run = promisify(execFile);

/**
 * `--external-images` and `--auto-desk`, run for real.
 *
 * The unit tests prove the pieces; this proves the wiring, which is where the two
 * features meet everything else: the pre-pass has to agree with the post phase on which
 * spelling of a URL is looked up, the storage check has to come before the first write,
 * a hotlinked image that 404s must not turn a successful import into exit 1, and the
 * second run must reuse what the first one hosted instead of fetching it again.
 */

const TIMEOUT = 120_000;

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
  summary: { counts: Record<string, number>; failures: { id: string; reason: string }[] } | null;
}

async function cli(args: string[], env: NodeJS.ProcessEnv): Promise<CliRun> {
  let code = 0;
  let stdout = '';
  let stderr = '';
  try {
    const out = await run('node', ['--import', 'tsx', 'scripts/wp/import.ts', '--rate', '0', ...args], {
      env,
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = String(out.stdout);
    stderr = String(out.stderr);
  } catch (err) {
    const failed = err as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.stdout !== 'string') throw err;
    code = typeof failed.code === 'number' ? failed.code : 1;
    stdout = failed.stdout;
    stderr = failed.stderr ?? '';
  }
  const start = stdout.lastIndexOf('{\n  "summary"');
  const summary =
    start === -1 ? null : (JSON.parse(stdout.slice(start)) as { summary: NonNullable<CliRun['summary']> }).summary;
  return { code, stdout, stderr, summary };
}

type DocumentNode = { type: string; attrs?: { mediaId?: string } };

const imageNodes = (article: Row | undefined): string[] =>
  ((article?.['document'] as { nodes: DocumentNode[] } | undefined)?.nodes ?? [])
    .filter((node) => node.type === 'image')
    .map((node) => node.attrs?.mediaId ?? '');

describe('wp:import --external-images --auto-desk against a live pair of stand-ins', () => {
  let wp: FakeWordPress;
  let cms: FakeKalEl;
  let workdir: string;

  beforeAll(async () => {
    wp = await startFakeWordPress(0, { acervo: true });
    cms = await startFakeKalEl(0, { writable: true, empty: true });
    workdir = await mkdtemp(path.join(tmpdir(), 'mn-acervo-'));
  }, TIMEOUT);

  afterAll(async () => {
    await wp?.close();
    await cms?.close();
    if (workdir) await rm(workdir, { recursive: true, force: true });
  });

  const env = (): NodeJS.ProcessEnv => ({
    ...process.env,
    WP_BASE_URL: wp.url,
    WP_ASSET_HOSTS: '127.0.0.1',
    KAL_EL_BASE_URL: cms.url,
    KAL_EL_SITE_ID: SITE_ID,
    KAL_EL_SERVICE_TOKEN: SERVICE_TOKEN,
  });

  const flags = (): string[] => [
    '--allow-private-assets',
    '--external-images',
    '--auto-desk',
    '--state',
    path.join(workdir, 'state.json'),
    '--out',
    workdir,
  ];

  it(
    'a dry run plans the downloads and the desk, and writes and fetches nothing',
    async () => {
      const result = await cli(flags(), env());

      expect(result.code).toBe(0);
      expect(result.summary?.counts).toMatchObject({
        externalImagesFound: 3,
        autoDeskAssigned: 1,
        autoDeskUnresolved: 1,
        noDesk: 1,
        // 2002 is 2000 published twice: read, skipped, and not counted as filed.
        duplicatesSkipped: 1,
        failed: 0,
      });
      expect(wp.externalRequests).toEqual([]);

      const copies = JSON.parse(await readFile(path.join(workdir, 'duplicates.json'), 'utf8')) as {
        duplicates: { skippedId: number; keptId: number; legacyPath: string; keptLegacyPath: string }[];
      };
      expect(copies.duplicates).toEqual([
        {
          skippedId: 2002,
          keptId: 2000,
          legacyPath: '/xbox-revela-novo-console-portatil-2/',
          keptLegacyPath: '/xbox-revela-novo-console-portatil/',
        },
      ]);
      expect(cms.contents().media).toHaveLength(0);
      expect(cms.contents().articles).toHaveLength(0);

      const plan = JSON.parse(await readFile(path.join(workdir, 'external-images.json'), 'utf8')) as {
        uniqueUrls: number;
        byHost: { host: string; uniqueUrls: number; occurrences: number }[];
      };
      // `capa.jpg` twice, spelled two ways, is one URL.
      expect(plan.uniqueUrls).toBe(3);
      expect(plan.byHost).toEqual([expect.objectContaining({ host: 'localhost', uniqueUrls: 3, occurrences: 4 })]);

      const desks = JSON.parse(await readFile(path.join(workdir, 'auto-desk.json'), 'utf8')) as {
        assigned: { postId: number; desk: string }[];
        unresolved: { postId: number; outcome: string; categories: string[] }[];
      };
      expect(desks.assigned).toEqual([expect.objectContaining({ postId: 2000, desk: 'games' })]);
      expect(desks.unresolved).toEqual([
        expect.objectContaining({ postId: 2001, outcome: 'no-signal', categories: ['noticias'] }),
      ]);
    },
    TIMEOUT,
  );

  it(
    'the first apply hosts what downloads, drops what does not, files the post, and exits 0',
    async () => {
      const result = await cli(['--apply', ...flags()], env());
      const store = cms.contents();

      expect(result.summary?.failures).toEqual([]);
      expect(result.code).toBe(0);
      expect(result.summary?.counts).toMatchObject({
        externalImagesTransferred: 1,
        // Gone, and an HTML page: the hosts' failures, not the import's.
        externalImagesFailed: 2,
        failed: 0,
        autoDeskAssigned: 1,
        // Left out on a list, as decided — not a failure that would stop the import session.
        noDesk: 1,
      });
      expect(store.articles.map((a) => a['externalKey'])).not.toContain('wp:post:2001');
      // The copy is not written; the post it copies is.
      expect(result.summary?.counts['duplicatesSkipped']).toBe(1);
      expect(store.articles.map((a) => a['externalKey'])).not.toContain('wp:post:2002');
      expect(store.articles.map((a) => a['externalKey'])).toContain('wp:post:2000');
      // The image of a post that is not imported is not worth fetching.
      expect(wp.externalRequests).not.toContain('/external/nunca.jpg');

      const hosted = store.media.find((m) => String(m['externalKey']).startsWith('wp:external:'));
      expect(store.media).toHaveLength(3);
      expect(hosted?.['externalKey']).toMatch(/^wp:external:[0-9a-f]{32}$/);
      expect(hosted).toMatchObject({ credit: 'Imagem: localhost', altText: 'Console portátil em destaque' });
      // Downloaded once, with the query string the article used, decoded from `&#038;`.
      expect(wp.externalRequests.filter((r) => r.startsWith('/external/capa.jpg'))).toEqual([
        '/external/capa.jpg?w=1100&q=80',
      ]);

      // Both posts show it, however each spelled it.
      const unfiled = store.articles.find((a) => a['externalKey'] === 'wp:post:2000');
      const earlier = store.articles.find((a) => a['externalKey'] === 'wp:post:1001');
      expect(imageNodes(unfiled)).toEqual([hosted?.id]);
      expect(imageNodes(earlier)).toContain(hosted?.id);

      // Filed under Games, a desk this archive's categories never created.
      const games = store.categories.find((c) => c['slug'] === 'games');
      expect(games).toBeDefined();
      expect(unfiled?.['categories']).toEqual([games?.id]);
    },
    TIMEOUT,
  );

  it(
    'a second apply reuses the hosted image instead of fetching it again',
    async () => {
      const before = wp.externalRequests.length;
      const result = await cli(['--apply', '--resume', ...flags()], env());

      expect(result.code).toBe(0);
      expect(result.summary?.counts).toMatchObject({
        created: 0,
        externalImagesReused: 1,
        externalImagesTransferred: 0,
      });
      expect(cms.contents().media).toHaveLength(3);
      // Only the two that failed are tried again; the hosted one is never requested.
      expect(wp.externalRequests.slice(before).sort()).toEqual(['/external/pagina.jpg', '/external/sumiu.jpg']);
    },
    TIMEOUT,
  );

  it(
    'with the checkpoint lost, what Kal El holds under the external key is still reused',
    async () => {
      // The second apply above could pass on the state file alone. A fresh one leaves only
      // Kal El's own record — the externalKey the upload named in its query string.
      const before = wp.externalRequests.length;
      const fresh = flags().map((flag) =>
        flag.endsWith('state.json') ? path.join(workdir, 'fresh-state.json') : flag,
      );
      const result = await cli(['--apply', ...fresh], env());

      expect(result.code).toBe(0);
      expect(result.summary?.counts).toMatchObject({
        created: 0,
        mediaReused: 2,
        externalImagesReused: 1,
        externalImagesTransferred: 0,
      });
      expect(cms.contents().media).toHaveLength(3);
      expect(wp.externalRequests.slice(before).filter((r) => r.startsWith('/external/capa.jpg'))).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'an apply without --external-images is refused once images are hosted, before any write',
    async () => {
      // Its bodies would convert with the hosted images unresolved, and every article it
      // updated would be sent without them — exiting 0.
      const versions = cms.contents().articles.map((a) => `${String(a['externalKey'])}@${String(a['version'])}`);
      const result = await cli(['--apply', ...flags().filter((flag) => flag !== '--external-images')], env());

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('already hosted third-party images');
      expect(cms.contents().articles.map((a) => `${String(a['externalKey'])}@${String(a['version'])}`)).toEqual(
        versions,
      );
    },
    TIMEOUT,
  );
});

describe('the storage check comes before the first write', () => {
  let wp: FakeWordPress;
  let cms: FakeKalEl;
  let workdir: string;

  beforeAll(async () => {
    wp = await startFakeWordPress(0, { acervo: true });
    // An instance from before `GET /media/storage` existed.
    cms = await startFakeKalEl(0, { writable: true, empty: true, storage: 'absent' });
    workdir = await mkdtemp(path.join(tmpdir(), 'mn-storage-'));
  }, TIMEOUT);

  afterAll(async () => {
    await wp?.close();
    await cms?.close();
    if (workdir) await rm(workdir, { recursive: true, force: true });
  });

  const env = (): NodeJS.ProcessEnv => ({
    ...process.env,
    WP_BASE_URL: wp.url,
    WP_ASSET_HOSTS: '127.0.0.1',
    KAL_EL_BASE_URL: cms.url,
    KAL_EL_SITE_ID: SITE_ID,
    KAL_EL_SERVICE_TOKEN: SERVICE_TOKEN,
  });

  const flags = (): string[] => [
    '--apply',
    '--allow-private-assets',
    '--external-images',
    '--auto-desk',
    '--state',
    path.join(workdir, 'state.json'),
    '--out',
    workdir,
  ];

  it(
    'refuses an instance that cannot report its storage, having written nothing at all',
    async () => {
      const result = await cli(flags(), env());

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('refusing to upload');
      expect(result.stderr).toContain('--skip-storage-check');
      // Not even the taxonomy: 36.438 tags is an hour of writes to do before refusing.
      const store = cms.contents();
      expect(
        [store.media, store.articles, store.categories, store.tags, store.authors].map((rows) => rows.length),
      ).toEqual([0, 0, 0, 0, 0]);
      expect(wp.externalRequests).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    'lets an operator who has checked by other means say so',
    async () => {
      const result = await cli([...flags(), '--skip-storage-check'], env());
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('check skipped');
      expect(cms.contents().media).toHaveLength(3);
    },
    TIMEOUT,
  );
});
