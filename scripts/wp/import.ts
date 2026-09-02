#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ContentBlock, Image } from '@mn/content';
import { slugify, toPlainText } from '@mn/content';

import {
  COMMON_FLAGS,
  CliError,
  Counter,
  parseArgs,
  printHelp,
  printSummary,
  runAsScript,
  type RunSummary,
} from './cli';
import { idempotencyKey, loadState, mappingKey, saveState, type RunState } from './state';
import { ALLOWED_ASSET_TYPES, WordPressSource, detectImageType, type WpMedia, type WpPost } from './source';
import { isLoopbackHost } from '@mn/content/security/address';
import { KalElTarget } from './target';
import { emptyReport, htmlToBlocks, shortcodeAssetRef, type TransformReport } from './transform';

/**
 * WordPress → Kal El.
 *
 * Order is not incidental: taxonomies, then authors, then media, then posts. A post
 * cannot reference a category or a cover that does not exist yet, and doing it in this
 * order means a failure part-way through leaves a consistent target rather than articles
 * pointing at nothing.
 *
 * **Dry run is the default.** Without `--apply` no target client is even constructed, so
 * there is no code path from a rehearsal to a write. What a dry run does produce is the
 * full report: how many articles would be created versus updated, which blocks the parser
 * could not represent, and which images arrive without alt text.
 *
 *   pnpm wp:import --help
 *   pnpm wp:import                     # rehearsal, writes only reports
 *   pnpm wp:import --limit 50          # rehearse a slice
 *   pnpm wp:import --apply --resume    # real import, continuing from the checkpoint
 */

const FLAGS = [
  ...COMMON_FLAGS,
  {
    name: 'skip-media',
    description: 'do not transfer assets (posts keep no cover)',
    type: 'boolean' as const,
    default: false,
  },
  { name: 'max-asset-mb', description: 'largest asset to transfer', type: 'number' as const, default: 25 },
  {
    name: 'allow-private-assets',
    description: 'local rehearsal only: permit assets on loopback (refused unless every endpoint is local)',
    type: 'boolean' as const,
    default: false,
  },
];

/**
 * Everything a post refers to, keyed the way the post refers to it.
 *
 * A WordPress post carries **numeric ids** for its categories, tags and author. Keying
 * these by slug instead was a real defect: every lookup missed, so every imported
 * article arrived with no desk, no tags and no byline — and the portal drops articles
 * with no desk from every listing and from the sitemap, so they would have been
 * imported and then invisible.
 *
 * The slug map is kept as well, because the target is deduplicated by slug: two
 * WordPress terms that slugify the same are one Kal El term.
 */
export interface Indexes {
  categoryByWpId: Map<number, string>;
  tagByWpId: Map<number, string>;
  authorByWpId: Map<number, string>;
  categoryBySlug: Map<string, string>;
  tagBySlug: Map<string, string>;
  authorBySlug: Map<string, string>;
  /** WordPress media id -> Kal El media id. */
  mediaByWpId: Map<number, string>;
  /** Legacy asset URL -> Kal El image, for rewriting `<img src>` in bodies. */
  imageByUrl: Map<string, Image>;
}

export function emptyIndexes(): Indexes {
  return {
    categoryByWpId: new Map(),
    tagByWpId: new Map(),
    authorByWpId: new Map(),
    categoryBySlug: new Map(),
    tagBySlug: new Map(),
    authorBySlug: new Map(),
    mediaByWpId: new Map(),
    imageByUrl: new Map(),
  };
}

/** WordPress serves several sizes of the same asset; they all map to one original. */
function canonicalAssetUrl(url: string): string {
  return url.replace(/-\d+x\d+(\.[a-z]{3,4})$/i, '$1');
}

async function main(): Promise<void> {
  const { values } = parseArgs(process.argv.slice(2), FLAGS);
  if (values.help) {
    printHelp('wp:import', 'Imports the WordPress archive into Kal El, idempotently.', FLAGS);
    return;
  }

  const apply = values.apply === true;
  const limit = Number(values.limit ?? 0);
  const outDir = String(values.out);
  const statePath = String(values.state);
  const maxAssetBytes = Number(values['max-asset-mb']) * 1024 * 1024;

  const now = new Date().toISOString();
  const state: RunState = await loadState(statePath, now, values.resume === true);
  const report: TransformReport = emptyReport();
  const summary: RunSummary = {
    tool: 'wp:import',
    runId: state.runId,
    applied: apply,
    counts: new Counter(['read', 'created', 'updated', 'skipped', 'failed', 'mediaTransferred', 'mediaReused']),
    failures: [],
    artefacts: [],
  };

  const allowPrivateHosts = values['allow-private-assets'] === true;
  if (allowPrivateHosts) {
    // The flag only means anything when the whole run is local. Refusing it otherwise is
    // what stops it from becoming a way to point a production import at an internal
    // address — the guard it disables exists for exactly that.
    // Loopback, not merely "private". A Kal El on 10.0.0.5 is a *real* CMS on a real
    // internal network, and letting the flag through there would disable the guard
    // exactly where it protects something — which is the opposite of a local rehearsal.
    const urls = [process.env.WP_BASE_URL, process.env.KAL_EL_BASE_URL].filter(Boolean) as string[];
    const remote = urls.filter((url) => {
      try {
        return !isLoopbackHost(new URL(url).hostname);
      } catch {
        return true;
      }
    });
    // `WP_ASSET_HOSTS` is a third set of endpoints, and the one the flag actually
    // relaxes. Checking only the two base URLs left the obvious hole open: loopback for
    // both, `WP_ASSET_HOSTS=10.0.0.5`, and the fetch goes straight into the network with
    // the address check switched off.
    remote.push(
      ...(process.env.WP_ASSET_HOSTS ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h !== '' && !isLoopbackHost(h)),
    );
    if (remote.length > 0) {
      throw new CliError(
        `--allow-private-assets is for a local rehearsal and every endpoint must be loopback; these are not: ${remote.join(', ')}`,
      );
    }
    console.log('[wp:import] asset host check relaxed — local rehearsal only');
  }

  const source = WordPressSource.fromEnv({ requestsPerSecond: Number(values.rate), allowPrivateHosts });
  // Constructed only when applying: a dry run has no client that could write.
  const target = apply ? KalElTarget.fromEnv() : null;
  const indexes = emptyIndexes();

  console.log(apply ? '[wp:import] APPLYING — this writes to Kal El' : '[wp:import] dry run — nothing will be written');

  // ---------------------------------------------------------------- taxonomy
  //
  // Existing target terms are read first so a re-run reuses them instead of relying on
  // the idempotency key alone — the key expires, the slug does not.
  const existingBySlug = {
    categories: new Map<string, string>(),
    tags: new Map<string, string>(),
    authors: new Map<string, string>(),
  };
  if (target) {
    for (const [row, index] of [
      [await target.listCategories(), existingBySlug.categories],
      [await target.listTags(), existingBySlug.tags],
      [await target.listAuthors(), existingBySlug.authors],
    ] as const) {
      for (const entry of row.data ?? []) index.set(entry.slug, entry.id);
    }
  }

  /**
   * Ensures one term exists and records it under both keys.
   *
   * A failure here is a failure of the run: an article that loses its desk is worse than
   * an article that was not imported, because the first looks like success.
   */
  async function ensureTerm(
    kind: 'category' | 'tag' | 'author',
    wpId: number,
    slug: string,
    create: () => Promise<{ data: { id: string } | null; error: string | null }>,
    byWpId: Map<number, string>,
    bySlug: Map<string, string>,
    existing: Map<string, string>,
  ): Promise<void> {
    const known = bySlug.get(slug) ?? existing.get(slug);
    if (known) {
      byWpId.set(wpId, known);
      bySlug.set(slug, known);
      return;
    }
    if (!target) {
      const placeholder = `dry:${kind}:${slug}`;
      byWpId.set(wpId, placeholder);
      bySlug.set(slug, placeholder);
      return;
    }
    const res = await create();
    if (res.data?.id) {
      byWpId.set(wpId, res.data.id);
      bySlug.set(slug, res.data.id);
      return;
    }
    summary.counts.inc('failed');
    summary.failures.push({ id: `${kind}:${wpId}`, reason: res.error ?? 'unknown' });
  }

  for await (const batch of source.categories()) {
    for (const term of batch) {
      const slug = slugify(term.slug || term.name);
      await ensureTerm(
        'category',
        term.id,
        slug,
        () =>
          target!.createCategory(
            { name: term.name, slug, description: term.description || null },
            idempotencyKey('category', term.id),
          ),
        indexes.categoryByWpId,
        indexes.categoryBySlug,
        existingBySlug.categories,
      );
    }
  }

  for await (const batch of source.tags()) {
    for (const term of batch) {
      const slug = slugify(term.slug || term.name);
      await ensureTerm(
        'tag',
        term.id,
        slug,
        () => target!.createTag({ name: term.name, slug }, idempotencyKey('tag', term.id)),
        indexes.tagByWpId,
        indexes.tagBySlug,
        existingBySlug.tags,
      );
    }
  }

  for await (const batch of source.authors()) {
    for (const author of batch) {
      const slug = slugify(author.slug || author.name);
      await ensureTerm(
        'author',
        author.id,
        slug,
        () =>
          target!.createAuthor(
            { name: author.name, slug, bio: author.description || null },
            idempotencyKey('author', author.id),
          ),
        indexes.authorByWpId,
        indexes.authorBySlug,
        existingBySlug.authors,
      );
    }
  }

  // ------------------------------------------------------------------- media
  if (values['skip-media'] !== true) {
    const alreadyImported = target ? await target.mediaIndexByExternalKey() : new Map<string, string>();
    const deps: AssetImportDeps = { source, target, indexes, state, summary, report, alreadyImported, maxAssetBytes };

    for await (const batch of source.media()) {
      for (const asset of batch) await importAsset(asset, deps);
      await saveState(statePath, state);
    }
  }

  // ------------------------------------------------------------------- posts
  const since = values.since ? String(values.since) : undefined;
  let processed = 0;

  outer: for await (const batch of source.posts(since)) {
    for (const post of batch) {
      if (limit > 0 && processed >= limit) break outer;
      processed += 1;
      summary.counts.inc('read');

      try {
        const result = await importPost(post, { target, indexes, report, state });
        summary.counts.inc(result);
      } catch (err) {
        summary.counts.inc('failed');
        summary.failures.push({ id: `wp:post:${post.id}`, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    state.cursor = processed;
    await saveState(statePath, state);
  }

  // ----------------------------------------------------------------- reports
  await mkdir(outDir, { recursive: true });
  const unknownPath = path.join(outDir, 'unknown-blocks.ndjson');
  await writeFile(
    unknownPath,
    report.samples.map((s) => JSON.stringify(s)).join('\n') + (report.samples.length ? '\n' : ''),
    'utf8',
  );
  const reportPath = path.join(outDir, 'import-report.json');
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        runId: state.runId,
        applied: apply,
        counts: summary.counts.toJSON(),
        unknownBlocks: report.unknown,
        droppedTags: report.droppedTags,
        droppedAttributes: report.droppedAttributes,
        imagesMissingAlt: report.imagesMissingAlt,
        failures: summary.failures.slice(0, 200),
      },
      null,
      2,
    ),
    'utf8',
  );
  await saveState(statePath, state);

  summary.artefacts = [reportPath, unknownPath, statePath];
  printSummary(summary);

  if (exitCodeFor(apply, summary) === 1) process.exit(1);
}

/**
 * Turns whatever a body says about an image into the image Kal El now holds.
 *
 * Exported so it can be exercised end-to-end with the indexes `importAsset` actually
 * builds: this resolver and that indexing step are one contract, and a test that
 * reimplements either half proves nothing about the pair.
 */
/**
 * The run's exit code.
 *
 * A dry run that found problems is a success — finding them is what it is for. A run
 * that wrote is different: any failed term, asset or post has to reach CI, because an
 * import that exits 0 having lost every cover looks exactly like one that worked.
 */
export function exitCodeFor(apply: boolean, summary: RunSummary): 0 | 1 {
  return apply && summary.counts.get('failed') > 0 ? 1 : 0;
}

export function imageResolver(indexes: Indexes): (src: string) => Image | null {
  return (src) => indexes.imageByUrl.get(canonicalAssetUrl(src)) ?? null;
}

export interface AssetImportDeps {
  source: Pick<WordPressSource, 'fetchAsset'>;
  target: Pick<KalElTarget, 'uploadMedia' | 'updateMediaMetadata'> | null;
  indexes: Indexes;
  state: RunState;
  summary: RunSummary;
  report: TransformReport;
  /** Media already in Kal El under this run's external keys, from an earlier run. */
  alreadyImported: Map<string, string>;
  maxAssetBytes: number;
}

/**
 * Transfers one asset and records every way a body can refer to it.
 *
 * Two keys, not one. A body written in HTML points at the legacy URL; a body that used
 * `[gallery ids="12,34"]` names the media *id*, and the shortcode expansion emits
 * `shortcodeAssetRef(12)` because the Kal El id is not knowable at parse time. Indexing
 * only the URL is why every gallery image resolved to nothing and dropped out of the
 * article — silently, because an image the resolver cannot place is simply not emitted.
 */
export async function importAsset(asset: WpMedia, deps: AssetImportDeps): Promise<void> {
  const { source, target, indexes, state, summary, report, alreadyImported, maxAssetBytes } = deps;
  const externalKey = `wp:media:${asset.id}`;
  const url = canonicalAssetUrl(asset.source_url);
  const image = describeAsset(asset, url);

  /** Both references an article body can carry for this asset. */
  const register = (kalElUrl: string): void => {
    indexes.imageByUrl.set(url, { ...image, url: kalElUrl });
    indexes.imageByUrl.set(shortcodeAssetRef(asset.id), { ...image, url: kalElUrl });
  };

  const finished = state.mappings[mappingKey('media', asset.id)];
  const reused = alreadyImported.get(externalKey) ?? finished;
  if (reused) {
    indexes.mediaByWpId.set(asset.id, reused);
    register(`/media/${reused}`);
    summary.counts.inc('mediaReused');

    // This is the only moment the asset is looked at again, so it is the only chance to
    // pay back metadata an earlier run failed to write. Two ways to owe it: the debt was
    // recorded, or there is no local record of ever having finished this asset — the
    // file is in Kal El, so a previous run got that far and then stopped, and whether
    // the second call landed is exactly what nobody knows.
    if (target && (state.pendingMediaMeta.includes(asset.id) || finished === undefined)) {
      // Recording it closes the debt for good. Without this the asset would have no
      // mapping, so every later run would read it as unfinished and PATCH it again.
      if (await saveMediaMetadata(target, reused, asset, image, externalKey, state, summary)) {
        state.mappings[mappingKey('media', asset.id)] = reused;
      }
    }
    return;
  }

  if (!ALLOWED_ASSET_TYPES.has(asset.mime_type)) {
    report.unknown[`media:${asset.mime_type}`] = (report.unknown[`media:${asset.mime_type}`] ?? 0) + 1;
    return;
  }
  if (image.alt.trim() === '') report.imagesMissingAlt += 1;

  if (!target) {
    register(`dry:/media/${asset.id}`);
    return;
  }

  const fetched = await source.fetchAsset(asset.source_url, maxAssetBytes);
  if (!fetched) {
    // Counted, not just listed: the exit code reads the counter, and an import that
    // lost every cover to a network fault must not report success.
    summary.counts.inc('failed');
    summary.failures.push({ id: externalKey, reason: 'asset could not be downloaded or exceeded the size limit' });
    return;
  }
  // The source server writes the Content-Type; only the bytes are trusted.
  const detected = detectImageType(fetched.data);
  if (!detected) {
    summary.counts.inc('failed');
    summary.failures.push({ id: externalKey, reason: 'bytes are not a recognised raster image' });
    return;
  }

  const filename = path.basename(new URL(url).pathname) || `${asset.slug}.jpg`;
  const uploaded = await target.uploadMedia(filename, fetched.data, detected, externalKey);
  if (!uploaded.id) {
    summary.counts.inc('failed');
    summary.failures.push({ id: externalKey, reason: uploaded.error ?? 'upload failed' });
    return;
  }

  indexes.mediaByWpId.set(asset.id, uploaded.id);
  register(`/media/${uploaded.id}`);
  summary.counts.inc('mediaTransferred');

  // Written only once the metadata is on the record too: the mapping is what a later run
  // reads as "this asset is done", and an asset whose second call never landed is not.
  if (await saveMediaMetadata(target, uploaded.id, asset, image, externalKey, state, summary)) {
    state.mappings[mappingKey('media', asset.id)] = uploaded.id;
  }
}

/**
 * Writes alt text and caption, reporting whether it landed and remembering it if not.
 *
 * Metadata is a second call: Kal El's upload endpoint takes the file only. Alt text is
 * an accessibility and licensing requirement, so a failure here is a failed asset — and
 * it is recorded in the checkpoint, because the next run reuses the uploaded file and
 * would otherwise never come back to it.
 */
async function saveMediaMetadata(
  target: Pick<KalElTarget, 'updateMediaMetadata'>,
  mediaId: string,
  asset: WpMedia,
  image: Image,
  externalKey: string,
  state: RunState,
  summary: RunSummary,
): Promise<boolean> {
  // A rejected request is the same outcome as a rejected response, and has to be
  // recorded the same way: letting it escape would kill the run before the checkpoint
  // that remembers the debt is written, and the next run would find the file already
  // uploaded and never come back to it.
  const meta = await target
    .updateMediaMetadata(mediaId, { altText: image.alt || null, caption: image.caption ?? null })
    .catch((err: unknown) => ({
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    }));

  const pending = new Set(state.pendingMediaMeta);
  if (meta.data) {
    pending.delete(asset.id);
  } else {
    pending.add(asset.id);
    summary.counts.inc('failed');
    summary.failures.push({ id: externalKey, reason: `metadata not saved: ${meta.error ?? 'unknown'}` });
  }
  state.pendingMediaMeta = [...pending];
  return meta.data !== null;
}

function describeAsset(asset: WpMedia, url: string): Image {
  return {
    url,
    width: asset.media_details.width ?? 1200,
    height: asset.media_details.height ?? 675,
    alt: asset.alt_text ?? '',
    ...(asset.caption ? { caption: toPlainText(asset.caption) } : {}),
  };
}

interface ImportContext {
  target: KalElTarget | null;
  indexes: Indexes;
  report: TransformReport;
  state: RunState;
}

/**
 * One post.
 *
 * Returns what happened so the caller can count it: `created`, `updated` or `skipped`.
 * The distinction is the whole point of running twice — a second run must report
 * `updated`/`skipped` and never `created`.
 */
async function importPost(post: WpPost, ctx: ImportContext): Promise<'created' | 'updated' | 'skipped'> {
  const { target, indexes, report } = ctx;
  const externalKey = `wp:post:${post.id}`;
  const slug = slugify(post.slug);

  const blocks: ContentBlock[] = htmlToBlocks(post.content, {
    postId: post.id,
    report,
    resolveImage: imageResolver(indexes),
  });

  const document = {
    version: 2 as const,
    nodes: blocksToKalElNodes(blocks, indexes),
  };

  const body: Record<string, unknown> = {
    type: 'article',
    title: toPlainText(post.title),
    slug,
    excerpt: toPlainText(post.excerpt).slice(0, 2000) || null,
    document,
    externalKey,
    status: 'published',
    publishedAt: new Date(`${post.date_gmt}Z`).toISOString(),
    // Numeric WordPress ids, resolved through the id-keyed maps.
    categories: post.categories.map((id) => indexes.categoryByWpId.get(id)).filter((v): v is string => Boolean(v)),
    tags: post.tags.map((id) => indexes.tagByWpId.get(id)).filter((v): v is string => Boolean(v)),
    authors: [indexes.authorByWpId.get(post.author)].filter((v): v is string => Boolean(v)),
    provenance: {
      system: 'wordpress',
      sources: [{ provider: 'wordpress', externalId: String(post.id), externalUrl: post.link }],
    },
  };

  const cover = indexes.mediaByWpId.get(post.featured_media);
  if (cover) body.featuredMediaId = cover;

  if (!target) return 'skipped';

  const existing = await target.findArticleByExternalKey(externalKey);
  if (existing) {
    // Did an editor touch this since we last wrote it?
    const ours = ctx.state.articleVersions[externalKey];
    if (ours !== undefined && ours !== existing.version) {
      throw new CliError(
        `article ${externalKey} is at version ${existing.version} in Kal El but the import last wrote ${ours}; ` +
          'it was edited after import and is left untouched',
      );
    }
    /*
     * Every field the migration owns is re-sent, not just the text.
     *
     * A partial update means a first run that got something wrong — a missing desk, a
     * missing byline — can never be repaired by running again, which defeats the point
     * of an idempotent importer. Status and publication date are deliberately excluded:
     * those belong to the editorial workflow once the article lives in the CMS.
     */
    const res = await target.updateArticle(
      existing.id,
      {
        title: body.title,
        excerpt: body.excerpt,
        document,
        slug,
        categories: body.categories,
        tags: body.tags,
        authors: body.authors,
        ...(body.featuredMediaId ? { featuredMediaId: body.featuredMediaId } : {}),
        provenance: body.provenance,
      },
      existing.version,
    );
    if (res.status === 409) {
      // Someone edited this article in the CMS after it was imported. Overwriting an
      // editorial change with a re-import is worse than skipping it and reporting.
      throw new CliError(`article ${externalKey} changed in Kal El since the last import; left untouched`);
    }
    if (!res.data) throw new CliError(`update failed for ${externalKey}: ${res.error ?? 'unknown'}`);
    ctx.state.mappings[mappingKey('post', post.id)] = existing.id;
    ctx.state.articleVersions[externalKey] = res.data.version;
    return 'updated';
  }

  const created = await target.createArticle(body, idempotencyKey('post', post.id));
  if (!created.data?.id) throw new CliError(`create failed for ${externalKey}: ${created.error ?? 'unknown'}`);
  ctx.state.mappings[mappingKey('post', post.id)] = created.data.id;
  ctx.state.articleVersions[externalKey] = created.data.version;
  return 'created';
}

/**
 * Domain blocks back to Kal El document nodes.
 *
 * Only the node types Kal El actually has. A `specTable` becomes a two-column `table`,
 * a `callout` becomes a paragraph — losing the presentation but never the words, which
 * is the right trade for a migration.
 */
function blocksToKalElNodes(blocks: ContentBlock[], indexes: Indexes): Record<string, unknown>[] {
  const inline = (content: { type: string; text?: string; marks?: { type: string; href?: string }[] }[]) =>
    content.map((node) =>
      node.type === 'break'
        ? { type: 'hardBreak' }
        : {
            type: 'text',
            text: node.text ?? '',
            marks: (node.marks ?? []).map((m) =>
              m.type === 'link' ? { type: 'link', attrs: { href: m.href } } : { type: m.type },
            ),
          },
    );

  const mediaIdFor = (url: string): string | null => {
    const match = /^\/media\/([0-9a-f-]{36})$/.exec(url);
    if (match?.[1]) return match[1];
    for (const [, id] of indexes.mediaByWpId) if (url.endsWith(id)) return id;
    return null;
  };

  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        nodes.push({ type: 'paragraph', attrs: {}, content: inline(block.content) });
        break;
      case 'heading':
        nodes.push({
          type: 'heading',
          attrs: { level: block.level },
          content: [{ type: 'text', text: block.text, marks: [] }],
        });
        break;
      case 'quote':
        nodes.push({ type: 'quote', attrs: {}, content: inline(block.content) });
        break;
      case 'list':
        nodes.push({
          type: 'list',
          attrs: { ordered: block.style === 'number' },
          content: block.items.map((item) => inline(item)),
        });
        break;
      case 'table':
        nodes.push({
          type: 'table',
          attrs: { headers: block.headers },
          content: block.rows.map((row) => row.map((cell) => inline(cell))),
        });
        break;
      case 'specTable':
        nodes.push({
          type: 'table',
          attrs: { headers: [] },
          content: block.rows.map((row) => [
            [{ type: 'text', text: row.label, marks: [] }],
            [{ type: 'text', text: row.value, marks: [] }],
          ]),
        });
        break;
      case 'image': {
        const mediaId = mediaIdFor(block.image.url);
        if (!mediaId) break;
        nodes.push({
          type: 'image',
          attrs: {
            mediaId,
            ...(block.image.caption ? { caption: block.image.caption } : {}),
            ...(block.image.credit ? { credit: block.image.credit } : {}),
            altText: block.image.alt,
          },
        });
        break;
      }
      case 'embed':
        nodes.push({ type: 'embed', attrs: { url: block.url, provider: block.provider } });
        break;
      case 'callout':
        // No callout node in the CMS: the words survive as a paragraph.
        nodes.push({ type: 'paragraph', attrs: {}, content: inline(block.content) });
        break;
      case 'sourceLink':
        nodes.push({
          type: 'source',
          attrs: { label: block.label, url: block.url, ...(block.kind ? { kind: block.kind } : {}) },
        });
        break;
      default:
        // gallery, comparison, buyBox, ad and whereToWatch are front-end constructs; a
        // WordPress body never produces them.
        break;
    }
  }
  return nodes;
}

runAsScript(import.meta.url, main);
