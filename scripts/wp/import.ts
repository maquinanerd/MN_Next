#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ContentBlock, Image } from '@mn/content';
import { DESK_SLUGS, EDITORIA_NAMES, isEditoriaSlug, slugify, toPlainText } from '@mn/content';

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
import { forEachConcurrent } from './concurrency';
import {
  EXTERNAL_KEY_PREFIX,
  ExternalImageCollector,
  externalImageDownloader,
  externalImagesSummary,
  importExternalImages,
  type ExternalImage,
  type ExternalImageOutcome,
  type HostTally,
} from './external-images';
import { CheckpointWriter, idempotencyKey, loadState, mappingKey, type RunState } from './state';
import {
  ALLOWED_ASSET_TYPES,
  WordPressSource,
  detectImageType,
  type WpMedia,
  type WpPost,
  wpSlug,
  type WpReadSource,
} from './source';
import { WordPressArchive } from './archive';
import { isLoopbackHost } from '@mn/content/security/address';
import { KalElTarget } from './target';
import { WP_DESKS_ALSO_TAGGED, classifyCategory, deskOf, deskFor, loadCategoryMap, type CategoryMap } from './taxonomy';
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
  {
    name: 'source',
    description: 'where WordPress is read from: rest (a live site) or archive (a .sql dump)',
    type: 'string' as const,
    default: 'rest',
  },
  { name: 'dump', description: 'archive source: path to the .sql or .sql.gz dump', type: 'string' as const },
  { name: 'uploads', description: 'archive source: extracted wp-content/uploads', type: 'string' as const },
  { name: 'table-prefix', description: 'archive source: WordPress table prefix', type: 'string' as const },
  {
    name: 'category-map',
    description: 'JSON of "wp-category-slug": "desk-slug" overrides',
    type: 'string' as const,
    default: 'data/import/category-map.json',
  },
  {
    name: 'concurrency',
    description: 'records handled at once: library assets, third-party images, posts',
    type: 'number' as const,
    default: 4,
  },
  {
    name: 'external-images',
    description: 'download third-party body images and host them in Kal El',
    type: 'boolean' as const,
    default: false,
  },
  {
    name: 'external-downloads',
    description: 'third-party downloads in flight at once, across every host',
    type: 'number' as const,
    default: 8,
  },
  {
    name: 'external-per-host',
    description: 'third-party downloads in flight at once from a single host',
    type: 'number' as const,
    default: 2,
  },
];

/** Media and posts are handed to the lanes in slices of this size, with a checkpoint after each. */
const BATCH = 200;

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
  /**
   * WordPress category id -> the desk it stands for.
   *
   * Only the categories that became desks are here. The other 8.613 became tags, and
   * this map is how a post's desk is found among its average of 2,8 categories.
   */
  deskSlugByWpId: Map<number, string>;
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
    deskSlugByWpId: new Map(),
    mediaByWpId: new Map(),
    imageByUrl: new Map(),
  };
}

/**
 * A post that cannot be filed anywhere.
 *
 * Carries the categories it *did* have, so the run can end with a list of the WordPress
 * categories that need a home rather than 298 identical error lines. That list is the
 * document the operator turns into `--category-map`.
 */
export class MissingDeskError extends CliError {
  constructor(
    message: string,
    readonly categories: number[],
  ) {
    super(message);
  }
}

/** WordPress serves several sizes of the same asset; they all map to one original. */
function canonicalAssetUrl(url: string): string {
  return url.replace(/-\d+x\d+(\.[a-z]{3,4})$/i, '$1');
}

/** Whether an earlier run hosted third-party images, as far as the checkpoint or Kal El can tell. */
function holdsHostedImages(state: RunState, alreadyImported: ReadonlyMap<string, string>): boolean {
  const prefix = mappingKey('external', '');
  for (const key of Object.keys(state.mappings)) if (key.startsWith(prefix)) return true;
  for (const key of alreadyImported.keys()) if (key.startsWith(EXTERNAL_KEY_PREFIX)) return true;
  return false;
}

/** A lane count from the command line: a whole number, and not one that turns politeness into a flood. */
function lanes(value: string | number | boolean | undefined, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 32) throw new CliError(`--${flag} must be a whole number from 1 to 32`);
  return n;
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
  const externalImages = values['external-images'] === true;
  const concurrency = lanes(values.concurrency, 'concurrency');
  const externalDownloads = lanes(values['external-downloads'], 'external-downloads');
  const externalPerHost = lanes(values['external-per-host'], 'external-per-host');

  const now = new Date().toISOString();
  const state: RunState = await loadState(statePath, now, values.resume === true);
  const report: TransformReport = emptyReport();
  const summary: RunSummary = {
    tool: 'wp:import',
    runId: state.runId,
    applied: apply,
    counts: new Counter([
      'read',
      'created',
      'updated',
      'skipped',
      'failed',
      'mediaTransferred',
      'mediaReused',
      'categoriesAsTags',
      'noDesk',
      'slugCollision',
      ...(externalImages
        ? ['externalImagesFound', 'externalImagesTransferred', 'externalImagesReused', 'externalImagesFailed']
        : []),
    ]),
    failures: [],
    artefacts: [],
  };

  const sourceKind = String(values.source);
  if (sourceKind !== 'rest' && sourceKind !== 'archive') {
    throw new CliError(`--source must be "rest" or "archive", not "${sourceKind}"`);
  }

  const allowPrivateHosts = values['allow-private-assets'] === true;
  // Meaningless for an archive: that reader opens no sockets, so there is no address
  // check to relax. Accepting the flag there would suggest otherwise.
  if (allowPrivateHosts && sourceKind === 'archive') {
    throw new CliError('--allow-private-assets is for --source rest; the archive reader makes no network requests');
  }
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

  const archive =
    sourceKind === 'archive'
      ? WordPressArchive.fromEnv({
          ...(values.dump ? { dumpPath: String(values.dump) } : {}),
          ...(values.uploads ? { uploadsDir: String(values.uploads) } : {}),
          ...(values['table-prefix'] ? { tablePrefix: String(values['table-prefix']) } : {}),
        })
      : null;
  const source: WpReadSource =
    archive ?? WordPressSource.fromEnv({ requestsPerSecond: Number(values.rate), allowPrivateHosts });

  if (archive) {
    const facts = await archive.prepare();
    console.log(
      `[wp:import] archive: ${facts.counts.posts} posts, ${facts.counts.attachments} attachments, ` +
        `${facts.counts.categories} categories, ${facts.counts.tags} tags, ${facts.counts.authors} authors`,
    );
    console.log(`[wp:import] archive: ${facts.siteUrl} with permalinks ${facts.permalinkStructure || '(none)'}`);
  }

  // The legacy site's own hostname, so the report can separate a broken media mapping
  // from an image that was always somebody else's.
  const legacyBase = archive ? (await archive.prepare()).siteUrl : process.env.WP_BASE_URL;
  let siteHost: { siteHost?: string } = {};
  try {
    if (legacyBase) siteHost = { siteHost: new URL(legacyBase).hostname };
  } catch {
    siteHost = {};
  }

  const categoryOverrides: CategoryMap = await loadCategoryMap(String(values['category-map']));
  if (categoryOverrides.size > 0) {
    console.log(`[wp:import] ${categoryOverrides.size} category overrides from ${String(values['category-map'])}`);
  }

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

  /*
   * A WordPress category is a desk, or it is a tag.
   *
   * The archive has 8.619 categories and the portal has six desks, so a one-to-one
   * import would invent 8.613 route segments that no template, no navigation and no
   * design has ever had. `taxonomy.ts` holds the rule and the evidence for it; here the
   * demoted ones simply go through the tag path, which means they keep their name, keep
   * their articles and stop pretending to be sections.
   */
  /** WordPress category id -> its slug, so an unfiled post can be reported by name. */
  const categorySlugByWpId = new Map<number, string>();
  /** WordPress categories that left posts with nowhere to go, and how many each. */
  const orphanCategories = new Map<string, number>();

  for await (const batch of source.categories()) {
    for (const term of batch) {
      const slug = slugify(term.slug || term.name);
      categorySlugByWpId.set(term.id, slug);
      if (classifyCategory(slug, categoryOverrides) === 'tag') {
        summary.counts.inc('categoriesAsTags');
        await ensureTerm(
          'tag',
          term.id,
          slug,
          () => target!.createTag({ name: term.name, slug }, idempotencyKey('tag', term.id)),
          indexes.tagByWpId,
          indexes.tagBySlug,
          existingBySlug.tags,
        );
        continue;
      }

      const desk = deskOf(slug, categoryOverrides) as string;
      indexes.deskSlugByWpId.set(term.id, desk);
      categorySlugByWpId.set(term.id, slug);
      await ensureTerm(
        'category',
        term.id,
        desk,
        () =>
          target!.createCategory(
            // A renamed desk takes the editoria's name, not the archive's ("Filmes" is now Cinema).
            {
              name: isEditoriaSlug(desk) ? EDITORIA_NAMES[desk] : term.name,
              slug: desk,
              description: term.description || null,
            },
            idempotencyKey('category', term.id),
          ),
        indexes.categoryByWpId,
        indexes.categoryBySlug,
        existingBySlug.categories,
      );

      // `reviews` is filed under Especiais and also kept as a tag, so its archive survives.
      if (WP_DESKS_ALSO_TAGGED.has(slug)) {
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

  const checkpoint = new CheckpointWriter(statePath, state);
  const since = values.since ? String(values.since) : undefined;

  /** Whether a post will be filed under a desk — answered from the plan, before anything exists. */
  const willBeFiled = (post: WpPost): boolean => post.categories.some((id) => indexes.deskSlugByWpId.has(id));

  // ------------------------------------------------------------------- media
  const skipMedia = values['skip-media'] === true;
  // One read of what Kal El already holds, before anything is uploaded, shared by both
  // kinds of media.
  const alreadyImported =
    target && (!skipMedia || externalImages) ? await target.mediaIndexByExternalKey() : new Map<string, string>();

  /*
   * An import that has hosted third-party images must go on resolving them.
   *
   * Without the flag they are not collected, so every body converts with those images
   * unresolved — and updating an article sends its whole document. Each article the run
   * touched would lose its hosted images, and the run would exit 0. The runbook's second
   * run and the cutover delta are exactly such runs, so this refuses before any write.
   */
  if (target && !externalImages && holdsHostedImages(state, alreadyImported)) {
    throw new CliError(
      'this import has already hosted third-party images: pass --external-images, or every article this run ' +
        'updates would be sent without them',
    );
  }

  /*
   * The library is listed in full before any of it is sent: collecting third-party images
   * needs to know which body images the library will answer for.
   */
  const library: WpMedia[] = [];
  if (!skipMedia) for await (const batch of source.media()) library.push(...batch);

  // ------------------------------------------------------ third-party images
  //
  // Collected by running the real transform over every post that will be imported, with
  // a resolver that answers for the library as it will be once imported. Whatever it
  // still cannot place, on a host other than the site's own, is a hotlinked image.
  let externals: ExternalImage[] = [];
  let unparseable = 0;
  if (externalImages) {
    const collector = new ExternalImageCollector();
    const libraryKeys = new Set<string>();
    for (const asset of library) {
      if (!ALLOWED_ASSET_TYPES.has(asset.mime_type)) continue;
      libraryKeys.add(canonicalAssetUrl(asset.source_url));
      libraryKeys.add(shortcodeAssetRef(asset.id));
    }
    const planned: Image = { url: '/media/planned', width: 1200, height: 675, alt: '' };
    const resolvePlanned = (src: string): Image | null =>
      libraryKeys.has(src) || libraryKeys.has(canonicalAssetUrl(src)) ? planned : null;

    let seen = 0;
    collect: for await (const batch of source.posts(since)) {
      for (const post of batch) {
        if (limit > 0 && seen >= limit) break collect;
        seen += 1;
        // An image in a post that will not be imported is not worth hosting.
        if (!willBeFiled(post)) continue;
        htmlToBlocks(post.content, {
          postId: post.id,
          report: emptyReport(),
          resolveImage: resolvePlanned,
          ...siteHost,
          onUnresolvedImage: collector.listener(post.id),
        });
      }
    }
    externals = collector.images();
    unparseable = collector.unparseable;
    summary.counts.inc('externalImagesFound', externals.length);
    console.log(
      `[wp:import] third-party images: ${externals.length} unique URLs on ${new Set(externals.map((i) => i.host)).size} hosts`,
    );
  }

  // ------------------------------------------------------------ library upload
  if (!skipMedia) {
    const deps: AssetImportDeps = { source, target, indexes, state, summary, report, alreadyImported, maxAssetBytes };
    for (let start = 0; start < library.length; start += BATCH) {
      try {
        await forEachConcurrent(library.slice(start, start + BATCH), concurrency, (asset) => importAsset(asset, deps));
      } finally {
        // Also on the way out of a failure: every asset that finished did so in Kal El,
        // and a mapping left unsaved is an upload the next run repeats.
        await checkpoint.save();
      }
    }
    library.length = 0;
  }

  // ------------------------------------------------- third-party image upload
  let externalTallies = new Map<string, HostTally>();
  const externalOutcomes: ExternalImageOutcome[] = [];
  if (externalImages) {
    try {
      externalTallies = await importExternalImages(externals, {
        target,
        imageByUrl: indexes.imageByUrl,
        state,
        summary,
        alreadyImported,
        download: externalImageDownloader({
          allowedHosts: new Set(externals.map((image) => image.host)),
          maxBytes: maxAssetBytes,
          // The rehearsal flag reaches body URLs only when they are this very machine.
          allowLoopbackHosts: allowPrivateHosts,
        }),
        concurrency,
        downloads: externalDownloads,
        perHost: externalPerHost,
        checkpoint: () => checkpoint.save(),
        record: (outcome) => externalOutcomes.push(outcome),
      });
    } finally {
      await checkpoint.save();
    }
  }
  const external = externalImages ? externalImagesSummary(externals, externalTallies, unparseable) : null;
  externals = [];

  // ------------------------------------------------------------------- posts
  let processed = 0;

  /*
   * Two articles cannot share a URL.
   *
   * `slugify` truncates at 120 characters and drops everything outside `[a-z0-9-]`, and
   * this newsroom writes headlines long enough for that to bite: two posts whose titles
   * agree for their first 120 characters produce one slug. Kal El would refuse the
   * second write, which is the right outcome and a terrible way to find out — so the
   * rehearsal counts them, and the report names them, before anything is written.
   */
  const slugsSeen = new Map<string, number>();
  const context: ImportContext = {
    target,
    indexes,
    report,
    state,
    summary,
    ...siteHost,
  };

  const importOne = async (post: WpPost): Promise<void> => {
    try {
      const result = await importPost(post, context);
      summary.counts.inc(result);
    } catch (err) {
      if (err instanceof MissingDeskError) {
        for (const id of err.categories) {
          const slug = categorySlugByWpId.get(id);
          if (slug) orphanCategories.set(slug, (orphanCategories.get(slug) ?? 0) + 1);
        }
      }
      summary.counts.inc('failed');
      summary.failures.push({ id: `wp:post:${post.id}`, reason: err instanceof Error ? err.message : String(err) });
    }
  };

  for await (const batch of source.posts(since)) {
    const plan = planPostBatch(batch, slugsSeen, limit > 0 ? limit - processed : Number.POSITIVE_INFINITY);
    processed += plan.taken;
    summary.counts.inc('read', plan.taken);
    for (const { post, slug, owner } of plan.collisions) {
      summary.counts.inc('slugCollision');
      summary.failures.push({
        id: `wp:post:${post.id}`,
        reason: `slug "${slug}" is already taken by wp:post:${owner}`,
      });
    }
    for (const wave of plan.waves) await forEachConcurrent(wave, concurrency, importOne);
    // The whole batch has settled, so every post before the cursor is done.
    state.cursor = processed;
    await checkpoint.save();
    if (limit > 0 && processed >= limit) break;
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
        source: sourceKind,
        counts: summary.counts.toJSON(),
        ...(archive ? { archive: archive.stats() } : {}),
        unknownBlocks: report.unknown,
        droppedTags: report.droppedTags,
        droppedAttributes: report.droppedAttributes,
        imagesMissingAlt: report.imagesMissingAlt,
        concurrency,
        ...(external
          ? {
              externalImages: {
                ...external,
                // The whole table is in external-images.json; here, the hosts that matter.
                byHost: external.byHost.slice(0, 15).map(({ samples: _samples, ...tally }) => tally),
              },
            }
          : {}),
        failures: summary.failures.slice(0, 200),
      },
      null,
      2,
    ),
    'utf8',
  );
  /*
   * The categories that left posts with nowhere to go.
   *
   * 298 posts in this archive resolve to no desk, and reporting them one line at a time
   * says almost nothing: what the operator needs is the handful of *categories* behind
   * them — `noticias` on 219, `trailers` on 12, and the theme's demo content on 40 —
   * ordered by how many posts each would rescue. Written in the shape `--category-map`
   * reads, so answering the question is filling in the destinations.
   */
  const unmappedPath = path.join(outDir, 'unmapped-categories.json');
  await writeFile(
    unmappedPath,
    JSON.stringify(
      {
        note: 'Categorias do WordPress que deixaram artigos sem editoria. Preencha com uma das seis e passe em --category-map.',
        desks: DESK_SLUGS,
        categories: [...orphanCategories.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([slug, posts]) => ({ slug, posts, desk: null })),
      },
      null,
      2,
    ),
    'utf8',
  );
  const artefacts = [reportPath, unknownPath, unmappedPath];

  if (external) {
    const externalPath = path.join(outDir, 'external-images.json');
    await writeFile(
      externalPath,
      JSON.stringify(
        {
          note:
            'Imagens de terceiros no corpo dos posts importados, por host. `failed` são falhas do host ' +
            '(não mudam o código de saída); `failedOnKalEl` são nossas e contam em `failed` da execução.',
          applied: apply,
          ...external,
        },
        null,
        2,
      ),
      'utf8',
    );
    // One line per image: what was hosted, from where, under which media id.
    const auditPath = path.join(outDir, 'external-images.ndjson');
    const lines = [...externalOutcomes].sort((a, b) => a.host.localeCompare(b.host) || a.url.localeCompare(b.url));
    await writeFile(
      auditPath,
      lines.map((line) => JSON.stringify(line)).join('\n') + (lines.length ? '\n' : ''),
      'utf8',
    );
    artefacts.push(externalPath, auditPath);
  }

  await checkpoint.save();

  summary.artefacts = [...artefacts, statePath];
  printSummary(summary);

  // See `runAsScript`: set, not exited with, so a run that wrote exits cleanly on Windows.
  process.exitCode = exitCodeFor(apply, summary);
}

export interface PostBatchPlan {
  /** Every post of a wave runs after the whole previous wave has settled. */
  waves: WpPost[][];
  /** Posts whose slug an earlier post already claimed; they are still imported, after it. */
  collisions: { post: WpPost; slug: string; owner: number }[];
  /** How many posts of the batch fit under `--limit`. */
  taken: number;
}

/**
 * Which posts of a source batch run at once, and which must wait.
 *
 * Two posts that slugify alike cannot both have the URL, and Kal El refuses the second
 * create. Run sequentially, the earlier post always won. Run in lanes, the two would race
 * and the URL would go to whichever request landed first — while the report named the
 * earlier post as the owner. So a post whose slug is already claimed goes in a second
 * wave, after the post that claimed it has settled, and ownership stays in source order.
 */
export function planPostBatch(
  batch: readonly WpPost[],
  slugsSeen: Map<string, number>,
  capacity: number,
): PostBatchPlan {
  const first: WpPost[] = [];
  const later: WpPost[] = [];
  const collisions: PostBatchPlan['collisions'] = [];
  let taken = 0;
  for (const post of batch) {
    if (taken >= capacity) break;
    taken += 1;
    const slug = slugify(wpSlug(post.slug));
    const owner = slugsSeen.get(slug);
    if (owner === undefined) {
      slugsSeen.set(slug, post.id);
      first.push(post);
    } else {
      collisions.push({ post, slug, owner });
      later.push(post);
    }
  }
  return { waves: [first, later].filter((wave) => wave.length > 0), collisions, taken };
}

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

/**
 * Turns whatever a body says about an image into the image Kal El now holds.
 *
 * Exported so it can be exercised end-to-end with the indexes `importAsset` actually
 * builds: this resolver and that indexing step are one contract, and a test that
 * reimplements either half proves nothing about the pair.
 *
 * The exact spelling first, then the canonical one. A library asset is registered under
 * its original URL, and every resized variant (`-800x450.jpg`) has to fall back to it. A
 * third-party image is registered under each exact `src` a body used, because there the
 * `-800x450` is not a variant of anything the import holds — it names a different file
 * on somebody else's server — and folding it would show one rendition in place of another.
 */
export function imageResolver(indexes: Indexes): (src: string) => Image | null {
  return (src) => indexes.imageByUrl.get(src) ?? indexes.imageByUrl.get(canonicalAssetUrl(src)) ?? null;
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

  // A rejected read is the same outcome as a refused one. Under concurrency an escaping
  // error would also abandon every other asset in flight, whose uploads have landed and
  // whose mappings would never reach the checkpoint.
  const fetched = await source.fetchAsset(asset.source_url, maxAssetBytes).catch(() => null);
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
  const uploaded = await target
    .uploadMedia(filename, fetched.data, detected, externalKey)
    .catch((err: unknown) => ({ status: 0, id: null, error: err instanceof Error ? err.message : String(err) }));
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
  summary: RunSummary;
  /** The legacy site's hostname, so an unresolved image can name the publisher it came from. */
  siteHost?: string;
}

/**
 * One desk, and every tag the post carries — including the categories that became tags.
 *
 * A WordPress post in this archive averages 2,8 categories. Exactly one of them can be
 * the desk, because the desk is the article's URL; the rest are perfectly good tags and
 * are kept as such, so `noticias` survives on all 32.781 posts that had it instead of
 * being thrown away for not being a section.
 *
 * The desks a post carries but does not get filed under — 190 posts, always a second
 * desk — are dropped rather than tagged: a tag called "Filmes" sitting next to the desk
 * `series` reads as a section and is not one.
 */
export function resolveTaxonomy(post: WpPost, indexes: Indexes): { categories: string[]; tags: string[] } {
  const deskSlugs = post.categories
    .map((id) => indexes.deskSlugByWpId.get(id))
    .filter((slug): slug is string => slug !== undefined);
  const desk = deskFor(deskSlugs);

  const deskId =
    desk === null
      ? undefined
      : post.categories
          .filter((id) => indexes.deskSlugByWpId.get(id) === desk)
          .map((id) => indexes.categoryByWpId.get(id))
          .find((id): id is string => id !== undefined);

  const tags = new Set<string>();
  for (const id of [...post.tags, ...post.categories]) {
    const tagId = indexes.tagByWpId.get(id);
    if (tagId) tags.add(tagId);
  }

  return { categories: deskId ? [deskId] : [], tags: [...tags] };
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
  const slug = slugify(wpSlug(post.slug));
  const taxonomy = resolveTaxonomy(post, indexes);
  if (taxonomy.categories.length === 0) {
    // Not a warning. The portal drops an article with no desk from every listing and
    // from the sitemap, so importing it anyway produces something that exists in the CMS
    // and cannot be reached from the site — the failure mode that looks most like
    // success. 298 posts in this archive land here; `--category-map` is how they are
    // given a home.
    ctx.summary.counts.inc('noDesk');
    throw new MissingDeskError(
      `post ${post.id} (${post.slug}) has no desk: its categories are not among the six, and no --category-map entry covers them`,
      post.categories,
    );
  }

  const blocks: ContentBlock[] = htmlToBlocks(post.content, {
    postId: post.id,
    report,
    resolveImage: imageResolver(indexes),
    ...(ctx.siteHost ? { siteHost: ctx.siteHost } : {}),
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
    categories: taxonomy.categories,
    tags: taxonomy.tags,
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
      case 'sourceLink':
        nodes.push({
          type: 'source',
          attrs: { label: block.label, url: block.url, ...(block.kind ? { kind: block.kind } : {}) },
        });
        break;
      default:
        // gallery and product are front-end constructs; a WordPress body never produces
        // them.
        break;
    }
  }
  return nodes;
}

runAsScript(import.meta.url, main);
