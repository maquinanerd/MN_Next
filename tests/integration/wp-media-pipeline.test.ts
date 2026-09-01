import { describe, expect, it } from 'vitest';

import { Counter, type RunSummary } from '../../scripts/wp/cli';
import {
  emptyIndexes,
  exitCodeFor,
  imageResolver,
  importAsset,
  type AssetImportDeps,
  type Indexes,
} from '../../scripts/wp/import';
import { emptyState, type RunState } from '../../scripts/wp/state';
import { emptyReport, htmlToBlocks } from '../../scripts/wp/transform';
import type { WpMedia } from '../../scripts/wp/source';

/**
 * The media half of the import, driven through the real functions.
 *
 * These cases exist because the previous test for galleries built its own resolver and
 * fed it the placeholders by hand — so it passed while production resolved none of them.
 * Everything here goes through the same \`importAsset\` the CLI calls and the same
 * \`imageResolver\` the article builder uses; nothing between the two is reimplemented.
 */

const ASSET: WpMedia = {
  id: 12,
  slug: 'capa-do-filme',
  source_url: 'https://old.example.com/wp-content/uploads/2019/capa.jpg',
  mime_type: 'image/jpeg',
  alt_text: 'Cena do filme',
  media_details: { width: 1600, height: 900 },
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

interface Harness {
  deps: AssetImportDeps;
  indexes: Indexes;
  state: RunState;
  summary: RunSummary;
  metadataCalls: string[];
}

function harness(over: Partial<AssetImportDeps> = {}, state = emptyState('2026-01-01T00:00:00.000Z')): Harness {
  const indexes = emptyIndexes();
  const summary: RunSummary = {
    tool: 'wp:import',
    runId: state.runId,
    applied: true,
    counts: new Counter(),
    failures: [],
    artefacts: [],
  };
  const metadataCalls: string[] = [];

  const deps: AssetImportDeps = {
    source: { fetchAsset: async () => ({ data: JPEG, mimeType: 'image/jpeg' }) },
    target: {
      uploadMedia: async () => ({ status: 201, id: 'kalel-uuid-12', error: null }),
      updateMediaMetadata: async (id: string) => {
        metadataCalls.push(id);
        return { status: 200, data: { id }, error: null };
      },
    },
    indexes,
    state,
    summary,
    report: emptyReport(),
    alreadyImported: new Map(),
    maxAssetBytes: 1024 * 1024,
    ...over,
  };
  return { deps, indexes, state, summary, metadataCalls };
}

describe('a gallery shortcode survives the whole import', () => {
  it('resolves [gallery ids] to the media the importer actually uploaded', async () => {
    const h = harness();
    await importAsset(ASSET, h.deps);

    // The same call the article builder makes, with the indexes importAsset just built.
    const blocks = htmlToBlocks('<p>antes</p>[gallery ids="12"]<p>depois</p>', {
      postId: 1,
      report: emptyReport(),
      resolveImage: imageResolver(h.indexes),
    });

    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('the gallery image was dropped from the article');
    expect(image.image.url).toBe('/media/kalel-uuid-12');
    expect(image.image.alt).toBe('Cena do filme');
  });

  it('resolves a plain <img> pointing at the legacy URL as well', async () => {
    const h = harness();
    await importAsset(ASSET, h.deps);

    const blocks = htmlToBlocks(
      '<p>a</p><img src="https://old.example.com/wp-content/uploads/2019/capa-300x200.jpg" alt="x" />',
      { postId: 1, report: emptyReport(), resolveImage: imageResolver(h.indexes) },
    );
    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('expected the image');
    expect(image.image.url).toBe('/media/kalel-uuid-12');
  });

  it('resolves a gallery image reused from an earlier run', async () => {
    const h = harness({ alreadyImported: new Map([['wp:media:12', 'kalel-from-run-1']]) });
    await importAsset(ASSET, h.deps);

    const blocks = htmlToBlocks('[gallery ids="12"]', {
      postId: 1,
      report: emptyReport(),
      resolveImage: imageResolver(h.indexes),
    });
    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('a reused asset must resolve too');
    expect(image.image.url).toBe('/media/kalel-from-run-1');
  });
});

describe('a lost asset is a failed run, not a quiet one', () => {
  it('counts a download failure so the exit code sees it', async () => {
    const h = harness({ source: { fetchAsset: async () => null } });
    await importAsset(ASSET, h.deps);

    expect(h.summary.counts.get('failed')).toBe(1);
    expect(h.summary.failures[0]?.id).toBe('wp:media:12');
    expect(exitCodeFor(true, h.summary)).toBe(1);
  });

  it('leaves a dry run green even when it found problems', async () => {
    const h = harness({ source: { fetchAsset: async () => null } });
    await importAsset(ASSET, h.deps);
    expect(exitCodeFor(false, h.summary)).toBe(0);
  });

  it('counts an upload that returned no id', async () => {
    const h = harness({
      target: {
        uploadMedia: async () => ({ status: 500, id: null, error: 'upstream' }),
        updateMediaMetadata: async (id: string) => ({ status: 200, data: { id }, error: null }),
      },
    });
    await importAsset(ASSET, h.deps);
    expect(exitCodeFor(true, h.summary)).toBe(1);
  });
});

describe('alt text owed by a failed run is paid back by the next one', () => {
  it('retries the metadata call on the next run instead of reusing silently', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');

    // Run 1: the file uploads, the metadata call fails.
    const first = harness(
      {
        target: {
          uploadMedia: async () => ({ status: 201, id: 'kalel-uuid-12', error: null }),
          updateMediaMetadata: async () => ({ status: 503, data: null, error: 'unavailable' }),
        },
      },
      state,
    );
    await importAsset(ASSET, first.deps);
    expect(first.summary.counts.get('failed')).toBe(1);
    expect(state.pendingMediaMeta).toEqual([12]);

    // Run 2: the asset is reused — and the metadata still owed is written.
    const second = harness({ alreadyImported: new Map([['wp:media:12', 'kalel-uuid-12']]) }, state);
    await importAsset(ASSET, second.deps);

    expect(second.metadataCalls).toEqual(['kalel-uuid-12']);
    expect(state.pendingMediaMeta).toEqual([]);
    expect(second.summary.counts.get('failed')).toBe(0);
    expect(second.summary.counts.get('mediaReused')).toBe(1);
  });

  it('treats a rejected metadata request the same as a rejected response', async () => {
    // A timeout throws instead of answering. Letting it escape would end the run before
    // the checkpoint that remembers the debt is written, and the next run would find the
    // file already uploaded and never come back to it.
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const h = harness(
      {
        target: {
          uploadMedia: async () => ({ status: 201, id: 'kalel-uuid-12', error: null }),
          updateMediaMetadata: async () => {
            throw new Error('ETIMEDOUT');
          },
        },
      },
      state,
    );

    await expect(importAsset(ASSET, h.deps)).resolves.toBeUndefined();
    expect(h.summary.counts.get('failed')).toBe(1);
    expect(h.summary.failures[0]?.reason).toContain('ETIMEDOUT');
    expect(state.pendingMediaMeta).toEqual([12]);
  });

  it('rewrites metadata for an asset the checkpoint never recorded as finished', async () => {
    // The run died between the upload and the checkpoint: Kal El has the file, the state
    // file has no memory of it. Nobody knows whether the second call landed, so the only
    // safe reading is that it did not.
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const h = harness({ alreadyImported: new Map([['wp:media:12', 'kalel-uuid-12']]) }, state);

    await importAsset(ASSET, h.deps);

    expect(h.metadataCalls).toEqual(['kalel-uuid-12']);
    expect(h.summary.counts.get('mediaReused')).toBe(1);
  });

  it('stops owing metadata once the retry lands', async () => {
    // Paying the debt has to be recorded, or the asset stays unmapped and every later
    // run reads it as unfinished and PATCHes it again.
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const reused = new Map([['wp:media:12', 'kalel-uuid-12']]);

    const retry = harness({ alreadyImported: reused }, state);
    await importAsset(ASSET, retry.deps);
    expect(retry.metadataCalls).toEqual(['kalel-uuid-12']);

    const third = harness({ alreadyImported: reused }, state);
    await importAsset(ASSET, third.deps);
    expect(third.metadataCalls).toEqual([]);
  });

  it('does not re-PATCH an asset whose metadata already landed', async () => {
    const state = emptyState('2026-01-01T00:00:00.000Z');
    const first = harness({}, state);
    await importAsset(ASSET, first.deps);
    expect(state.pendingMediaMeta).toEqual([]);

    const second = harness({ alreadyImported: new Map([['wp:media:12', 'kalel-uuid-12']]) }, state);
    await importAsset(ASSET, second.deps);
    // A re-run over a large library must not become one PATCH per asset.
    expect(second.metadataCalls).toEqual([]);
  });
});
