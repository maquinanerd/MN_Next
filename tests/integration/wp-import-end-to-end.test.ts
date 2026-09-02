import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVICE_TOKEN, SITE_ID } from '../fake-kalel/corpus';
import { startFakeKalEl, type FakeKalEl } from '../fake-kalel/server';
import { expected, startFakeWordPress, type FakeWordPress } from '../fake-wp/server';

const run = promisify(execFile);

async function runOrCapture(
  file: string,
  args: string[],
  opts: Parameters<typeof run>[2],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const out = await run(file, args, opts);
    return { stdout: String(out.stdout), stderr: String(out.stderr) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    if (typeof e.stdout === 'string') return { stdout: e.stdout, stderr: e.stderr ?? '' };
    throw err;
  }
}

/**
 * The importer, actually run.
 *
 * Every guarantee this tool makes has until now been a property of its design and of
 * unit tests around its pieces: dry run writes nothing, a second run updates instead of
 * duplicating, a failure exits non-zero. This runs the real CLI — as a subprocess, with
 * its real argv and its real environment — against a WordPress that answers like
 * WordPress and a Kal El that enforces `externalKey`, `Idempotency-Key` and `If-Match`.
 *
 * It is slow by the standards of this suite and worth every second: it is the only place
 * where "idempotent" is observed rather than asserted.
 */

const TIMEOUT = 120_000;

describe('wp:import against a live pair of stand-ins', () => {
  let wp: FakeWordPress;
  let cms: FakeKalEl;
  let workdir: string;

  beforeAll(async () => {
    wp = await startFakeWordPress();
    cms = await startFakeKalEl(0, { writable: true, empty: true });
    workdir = await mkdtemp(path.join(tmpdir(), 'mn-import-'));
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

  /**
   * Runs the CLI and returns its summary, whatever the exit code.
   *
   * A non-zero exit is not an error here — it is one of the behaviours under test. The
   * run that skips an article an editor changed *must* exit 1, and the summary it printed
   * on the way out is exactly what has to be read.
   */
  async function importRun(args: string[]): Promise<{ counts: Record<string, number>; failures: unknown[] }> {
    const { stdout } = await runOrCapture(
      'node',
      [
        '--import',
        'tsx',
        'scripts/wp/import.ts',
        '--rate',
        '0',
        '--allow-private-assets',
        '--state',
        path.join(workdir, 'state.json'),
        '--out',
        workdir,
        ...args,
      ],
      { env: env(), cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 },
    );
    // The last JSON object printed is the structured summary CI parses.
    const start = stdout.lastIndexOf('{\n  "summary"');
    expect(start, `no summary in output:\n${stdout.slice(-2000)}`).toBeGreaterThan(-1);
    const parsed = JSON.parse(stdout.slice(start)) as {
      summary: { counts: Record<string, number>; failures: unknown[] };
    };
    return parsed.summary;
  }

  it(
    'a dry run writes absolutely nothing',
    async () => {
      const summary = await importRun([]);

      // It read the whole corpus…
      expect(summary.counts['read']).toBeGreaterThanOrEqual(expected.posts);
      // …and the CMS is still empty. Not "no duplicates" — nothing at all.
      expect(cms.contents().articles).toHaveLength(0);
      expect(cms.contents().media).toHaveLength(0);
      expect(cms.contents().categories).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'the first apply creates every entity exactly once',
    async () => {
      const summary = await importRun(['--apply']);
      const store = cms.contents();

      expect(summary.failures).toEqual([]);
      expect(store.articles).toHaveLength(expected.posts);
      expect(store.categories).toHaveLength(expected.categories);
      expect(store.tags).toHaveLength(expected.tags);
      expect(store.authors).toHaveLength(expected.authors);
      expect(store.media).toHaveLength(expected.media);

      // The failure that made every imported article invisible: WordPress sends numeric
      // ids for author, categories and tags, and they were looked up in maps keyed by
      // slug. An article with no desk is dropped from every listing and from the sitemap.
      for (const article of store.articles) {
        expect(article['categories'], String(article['title'])).toHaveLength(1);
        expect(article['authors'], String(article['title'])).toHaveLength(1);
        expect((article['tags'] as string[]).length).toBeGreaterThan(0);
        expect(article['featuredMediaId']).toBeTruthy();
        expect(article['externalKey']).toMatch(/^wp:post:\d+$/);
      }
    },
    TIMEOUT,
  );

  it(
    'a second apply updates and creates nothing',
    async () => {
      const before = cms.contents();
      const idsBefore = before.articles.map((a) => a['id']).sort();
      const mediaBefore = before.media.length;

      const summary = await importRun(['--apply', '--resume']);
      const after = cms.contents();

      expect(summary.failures).toEqual([]);
      // The documented proof of idempotence, finally executed.
      expect(summary.counts['created'] ?? 0).toBe(0);
      expect(after.articles.map((a) => a['id']).sort()).toEqual(idsBefore);
      expect(after.media).toHaveLength(mediaBefore);
      expect(after.categories).toHaveLength(expected.categories);
    },
    TIMEOUT,
  );

  it(
    'an article edited in the CMS after import is left alone',
    async () => {
      // Version bumped behind the importer's back, as an editor would.
      const target = cms.contents().articles[0];
      expect(target).toBeDefined();
      const editedTitle = 'Título reescrito pela redação';
      Object.assign(target as Record<string, unknown>, {
        title: editedTitle,
        version: Number(target?.['version'] ?? 1) + 5,
      });

      const summary = await importRun(['--apply', '--resume']);

      // It is reported, not swallowed: the operator has to know one article was skipped.
      expect(JSON.stringify(summary.failures)).toContain('edited after import');

      // The importer read version N, sent If-Match: N, and the CMS refused. Overwriting
      // an editorial change with a re-import is worse than skipping and reporting.
      expect(cms.contents().articles[0]?.['title']).toBe(editedTitle);
    },
    TIMEOUT,
  );

  it(
    'the protection does not depend on --resume',
    async () => {
      // `--resume` decides where to continue from. It must not decide whether the tool
      // remembers what it has already written: a run without it used to discard
      // `articleVersions` and overwrite the same edited article the previous case proved
      // it would leave alone.
      const target = cms.contents().articles[0];
      const editedTitle = String(target?.['title']);
      expect(editedTitle).toContain('redação');

      const summary = await importRun(['--apply']);

      expect(JSON.stringify(summary.failures)).toContain('edited after import');
      expect(cms.contents().articles[0]?.['title']).toBe(editedTitle);
    },
    TIMEOUT,
  );

  it(
    'the body survives as typed nodes, with the shortcodes converted',
    async () => {
      const article = cms.contents().articles.find((a) => a['externalKey'] === 'wp:post:1000');
      expect(article).toBeDefined();
      const document = article?.['document'] as { version: number; nodes: { type: string }[] };

      expect(document.version).toBe(2);
      const types = document.nodes.map((n) => n.type);
      expect(types).toContain('paragraph');
      expect(types).toContain('heading');
      expect(types).toContain('list');
      // `[caption]`, `[gallery]` and `[embed]` used to vanish between two paragraphs.
      expect(types).toContain('image');
      expect(types).toContain('embed');
      expect(types).toContain('quote');
      // And no shortcode text survived into the body.
      expect(JSON.stringify(document)).not.toMatch(/\[(caption|gallery|embed)/);
    },
    TIMEOUT,
  );

  it(
    'no secret reaches the output of a run',
    async () => {
      const { stdout, stderr } = await run(
        'node',
        ['--import', 'tsx', 'scripts/wp/import.ts', '--rate', '0', '--limit', '2', '--out', workdir],
        { env: env(), cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 },
      );
      for (const stream of [stdout, stderr]) {
        expect(stream).not.toContain(SERVICE_TOKEN);
        expect(stream).not.toContain('Bearer ');
      }
    },
    TIMEOUT,
  );
});

describe('the local-rehearsal flag cannot reach a real network', () => {
  const cli = async (env: Record<string, string>): Promise<string> => {
    const { stdout, stderr } = await runOrCapture(
      'node',
      ['--import', 'tsx', 'scripts/wp/import.ts', '--apply', '--allow-private-assets', '--limit', '1'],
      { env: { ...process.env, ...env }, cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
    );
    return stdout + stderr;
  };

  const LOOPBACK: Record<string, string> = {
    WP_BASE_URL: 'http://127.0.0.1:9',
    KAL_EL_BASE_URL: 'http://127.0.0.1:9',
    KAL_EL_SITE_ID: '11111111-2222-4333-8444-555566667777',
    KAL_EL_SERVICE_TOKEN: 'ke_st.test',
  };

  it('refuses when the CMS is a real host', async () => {
    const out = await cli({ ...LOOPBACK, KAL_EL_BASE_URL: 'https://cms.example.com' });
    expect(out).toContain('local rehearsal');
  }, 60_000);

  it('refuses when an asset host is a real address', async () => {
    // The hole the second review found: both base URLs loopback, and the allowlist
    // pointing at an internal service. The flag relaxes exactly the check that would
    // have stopped that fetch.
    const out = await cli({ ...LOOPBACK, WP_ASSET_HOSTS: '10.0.0.5' });
    expect(out).toContain('local rehearsal');
    expect(out).toContain('10.0.0.5');
  }, 60_000);

  it('allows a fully local rehearsal', async () => {
    const out = await cli({ ...LOOPBACK, WP_ASSET_HOSTS: '127.0.0.1,localhost' });
    expect(out).not.toContain('local rehearsal and every endpoint');
  }, 60_000);
});
