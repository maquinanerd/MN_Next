import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Counter, type RunSummary } from '../../scripts/wp/cli';
import { Semaphore, forEachByHost, forEachConcurrent, singleFlight } from '../../scripts/wp/concurrency';
import { emptyIndexes, importAsset, planPostBatch, type AssetImportDeps } from '../../scripts/wp/import';
import type { WpMedia, WpPost } from '../../scripts/wp/source';
import { CheckpointWriter, emptyState, mappingKey, saveState, type RunState } from '../../scripts/wp/state';
import { emptyReport } from '../../scripts/wp/transform';

/**
 * Lanes, and what they must not break.
 *
 * Concurrency is only worth having if the run it produces is indistinguishable from the
 * sequential one: every mapping under its own asset, every debt recorded, a checkpoint
 * that is a whole file. The fakes here finish work in a deliberately hostile order —
 * last started, first done — so an assumption about completion order has nowhere to hide.
 */

const tick = (ms = 1): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('forEachConcurrent', () => {
  it('never runs more than the limit, and runs everything', async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await forEachConcurrent([...Array(20).keys()], 4, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await tick(20 - n);
      active -= 1;
      done.push(n);
    });
    expect(peak).toBe(4);
    expect([...done].sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
  });

  it('stops starting work after a failure, lets work in flight finish, then throws', async () => {
    const started: number[] = [];
    const finished: number[] = [];
    const run = forEachConcurrent([0, 1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      started.push(n);
      if (n === 1) throw new Error('um falhou');
      await tick(10);
      finished.push(n);
    });
    await expect(run).rejects.toThrow('um falhou');
    // 0 and 2 were in flight and completed; nothing past the failure's lane was begun.
    expect(finished).toEqual(expect.arrayContaining([0, 2]));
    expect(started.length).toBeLessThan(8);
  });
});

describe('Semaphore', () => {
  it('serves waiters in the order they arrived', async () => {
    const gate = new Semaphore(1);
    const order: string[] = [];
    await Promise.all(
      ['a', 'b', 'c', 'd'].map((name) =>
        gate.run(async () => {
          order.push(name);
          await tick(2);
        }),
      ),
    );
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('forEachByHost', () => {
  it('releases a host slot early without releasing the global one', async () => {
    let inHostStage = 0;
    let hostPeak = 0;
    let global = 0;
    let globalPeak = 0;
    await forEachByHost(
      [...Array(9).keys()].map((n) => ({ host: 'um.test', n })),
      { hostOf: (item) => item.host, global: 3, perHost: 1 },
      async (_item, slot) => {
        global += 1;
        globalPeak = Math.max(globalPeak, global);
        inHostStage += 1;
        hostPeak = Math.max(hostPeak, inHostStage);
        await tick(3);
        inHostStage -= 1;
        slot.release();
        await tick(6);
        global -= 1;
      },
    );
    expect(hostPeak).toBe(1);
    // After the host stage, items overlap: up to the global limit.
    expect(globalPeak).toBeGreaterThan(1);
    expect(globalPeak).toBeLessThanOrEqual(3);
  });

  it('finishes an empty list and reports a worker’s failure', async () => {
    await expect(
      forEachByHost([], { hostOf: String, global: 2, perHost: 1 }, async () => undefined),
    ).resolves.toBeUndefined();
    await expect(
      forEachByHost(['a.test', 'b.test'], { hostOf: String, global: 2, perHost: 1 }, async (host) => {
        if (host === 'b.test') throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');
  });
});

describe('checkpoints under concurrency', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mn-checkpoint-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('never writes the file twice at once, and folds a burst of saves into one more write', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    let writing = 0;
    let overlapped = false;
    let writes = 0;
    const writer = new CheckpointWriter('ignored.json', state, async () => {
      writing += 1;
      if (writing > 1) overlapped = true;
      writes += 1;
      await tick(5);
      writing -= 1;
    });

    await Promise.all(Array.from({ length: 10 }, () => writer.save()));
    expect(overlapped).toBe(false);
    // The first save writes; the nine that arrived during it share one follow-up.
    expect(writes).toBe(2);
  });

  it('resolves a save only once a write that started after it has finished', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const seen: string[] = [];
    const writer = new CheckpointWriter('ignored.json', state, async (_file, s) => {
      await tick(5);
      seen.push(s.mappings['wpMedia:1'] ?? 'nada');
    });

    const first = writer.save();
    state.mappings['wpMedia:1'] = 'depois';
    await writer.save();
    await first;
    expect(seen.at(-1)).toBe('depois');
  });

  it('replaces the checkpoint whole, leaving no temporary file behind', async () => {
    const file = path.join(dir, 'state.json');
    const state = emptyState('2026-01-01T00:00:00.000Z');
    state.mappings['wpPost:1'] = 'um';
    await saveState(file, state);
    state.mappings['wpPost:2'] = 'dois';
    await saveState(file, state);

    const saved = JSON.parse(await readFile(file, 'utf8')) as RunState;
    expect(saved.mappings).toEqual({ 'wpPost:1': 'um', 'wpPost:2': 'dois' });
    expect(await readdir(dir)).toEqual(['state.json']);
  });
});

describe('the library under lanes, finishing in the worst order', () => {
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

  const asset = (id: number): WpMedia => ({
    id,
    slug: `imagem-${id}`,
    source_url: `https://old.example.com/wp-content/uploads/2020/${id}.jpg`,
    mime_type: 'image/jpeg',
    alt_text: `Imagem ${id}`,
    media_details: { width: 800, height: 600 },
  });

  it('files every mapping and every debt under its own asset', async () => {
    const assets = [...Array(24).keys()].map((n) => asset(100 + n));
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const indexes = emptyIndexes();
    const summary: RunSummary = {
      tool: 'wp:import',
      runId: state.runId,
      applied: true,
      counts: new Counter(),
      failures: [],
      artefacts: [],
    };

    const deps: AssetImportDeps = {
      source: { fetchAsset: async () => ({ data: JPEG, mimeType: 'image/jpeg' }) },
      target: {
        // Earlier assets take longer, so completions arrive in reverse.
        uploadMedia: async (filename) => {
          const id = Number(filename.replace('.jpg', ''));
          await tick(130 - id);
          return { status: 201, id: `kalel-${id}`, error: null };
        },
        // Every third asset's metadata fails, from different lanes at different moments.
        updateMediaMetadata: async (mediaId) => {
          const id = Number(mediaId.replace('kalel-', ''));
          await tick(id % 5);
          return id % 3 === 0
            ? { status: 503, data: null, error: 'unavailable' }
            : { status: 200, data: { id: mediaId }, error: null };
        },
      },
      indexes,
      state,
      summary,
      report: emptyReport(),
      alreadyImported: new Map(),
      maxAssetBytes: 1024 * 1024,
    };

    await forEachConcurrent(assets, 6, (item) => importAsset(item, deps));

    const owed = assets.filter((a) => a.id % 3 === 0).map((a) => a.id);
    for (const a of assets) {
      expect(indexes.mediaByWpId.get(a.id)).toBe(`kalel-${a.id}`);
      expect(indexes.imageByUrl.get(a.source_url)?.url).toBe(`/media/kalel-${a.id}`);
      expect(state.mappings[mappingKey('media', a.id)]).toBe(owed.includes(a.id) ? undefined : `kalel-${a.id}`);
    }
    // No lane lost another's entry in the read-modify-write of the debt list.
    expect([...state.pendingMediaMeta].sort((a, b) => a - b)).toEqual(owed);
    expect(summary.counts.get('mediaTransferred')).toBe(24);
    expect(summary.counts.get('failed')).toBe(owed.length);
  });
});

describe('singleFlight', () => {
  it('makes one attempt for callers that arrive together, and remembers a success', async () => {
    let attempts = 0;
    const create = singleFlight(async (key: string) => {
      attempts += 1;
      await tick(5);
      return `id-${key}`;
    });
    expect(await Promise.all([create('games'), create('games'), create('games')])).toEqual([
      'id-games',
      'id-games',
      'id-games',
    ]);
    expect(await create('games')).toBe('id-games');
    expect(attempts).toBe(1);
  });

  it('forgets a failure, so the next caller tries again', async () => {
    const outcomes: (string | null | Error)[] = [null, new Error('ETIMEDOUT'), 'id-animes'];
    let attempts = 0;
    const create = singleFlight(async () => {
      const outcome = outcomes[attempts];
      attempts += 1;
      await tick(1);
      if (outcome instanceof Error) throw outcome;
      return outcome ?? null;
    });

    // The two callers waiting on the failed attempt share its failure…
    expect(await Promise.all([create('animes'), create('animes')])).toEqual([null, null]);
    // …and the next one is a new attempt, as is the one after a rejection.
    await expect(create('animes')).rejects.toThrow('ETIMEDOUT');
    expect(await create('animes')).toBe('id-animes');
    expect(await create('animes')).toBe('id-animes');
    expect(attempts).toBe(3);
  });
});

describe('who owns a contested slug does not depend on which lane finishes first', () => {
  const post = (id: number, slug: string): WpPost => ({
    id,
    date_gmt: '2025-07-20T12:00:00',
    modified_gmt: '2025-07-20T12:00:00',
    slug,
    status: 'publish',
    type: 'post',
    link: `https://old.example.com/${slug}/`,
    title: slug,
    content: '<p>texto</p>',
    excerpt: '',
    author: 1,
    featured_media: 0,
    categories: [],
    tags: [],
  });

  it('runs a post whose slug is taken only after the post that took it has settled', () => {
    // The archive's real case: the same article published twice, one id apart.
    const seen = new Map<string, number>();
    const plan = planPostBatch([post(9883, 'superman'), post(9884, 'superman'), post(9885, 'batman')], seen, Infinity);

    expect(plan.waves.map((wave) => wave.map((p) => p.id))).toEqual([[9883, 9885], [9884]]);
    expect(plan.collisions).toEqual([expect.objectContaining({ slug: 'superman', owner: 9883 })]);
    expect(plan.taken).toBe(3);
  });

  it('treats slugs that only differ past the 120 characters slugify keeps as one', () => {
    const long =
      'bomba-vanessa-kirby-revela-robert-downey-jr-como-doutor-destino-em-cena-pos-creditos-de-quarteto-fantastico-primeiros-passos';
    const plan = planPostBatch([post(9880, long), post(9886, `${long}-2`)], new Map(), Infinity);
    expect(plan.waves.map((wave) => wave.map((p) => p.id))).toEqual([[9880], [9886]]);
  });

  it('remembers owners across batches, and stops at the limit', () => {
    const seen = new Map<string, number>();
    planPostBatch([post(1, 'a'), post(2, 'b')], seen, Infinity);
    const next = planPostBatch([post(3, 'a'), post(4, 'c'), post(5, 'd')], seen, 2);

    expect(next.taken).toBe(2);
    expect(next.waves.map((wave) => wave.map((p) => p.id))).toEqual([[4], [3]]);
    expect(next.collisions).toEqual([expect.objectContaining({ owner: 1 })]);
    // Post 5 was beyond the limit: not read, and its slug not claimed.
    expect(seen.has('d')).toBe(false);
  });
});
