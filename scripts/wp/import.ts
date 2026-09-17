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
import { autoDeskReport, classifyDesk, deskSignalsOf, type DeskDecision, type TermName } from './auto-desk';
import { forEachConcurrent, singleFlight } from './concurrency';
import type { DuplicatePair } from './duplicates';
import {
  EXTERNAL_KEY_PREFIX,
  externalImageDownloader,
  externalImagesSummary,
  importExternalImages,
  type ExternalImage,
  type ExternalImageOutcome,
  type HostTally,
} from './external-images';
import { canonicalAssetUrl, planRun } from './plan';
import { CheckpointWriter, idempotencyKey, loadState, mappingKey, type RunState } from './state';
import {
  describeNeed,
  describeUploads,
  estimateNeed,
  storageVerdict,
  tallyUploads,
  type StorageNeed,
  type UploadsOnDisk,
} from './storage';
import {
  ALLOWED_ASSET_TYPES,
  WordPressSource,
  detectImageType,
  type WpAuthor,
  type WpMedia,
  type WpPost,
  type WpTerm,
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
  {
    name: 'skip-storage-check',
    description: 'upload without first confirming Kal El has room for it',
    type: 'boolean' as const,
    default: false,
  },
  {
    name: 'auto-desk',
    description: 'file posts with no desk by keyword evidence in their categories, tags and title',
    type: 'boolean' as const,
    default: false,
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
    /**
     * Left out by `--auto-desk`: WordPress filed it under no desk, and its own evidence
     * names none clearly. The owner's decision for these is that they stay out of the
     * import, on a list — auto-desk.json — rather than fail the run.
     */
    readonly leftOut = false,
  ) {
    super(message);
  }
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
  const autoDesk = values['auto-desk'] === true;
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
      'duplicatesSkipped',
      'mediaMissingUnused',
      ...(externalImages
        ? ['externalImagesFound', 'externalImagesTransferred', 'externalImagesReused', 'externalImagesFailed']
        : []),
      ...(autoDesk ? ['autoDeskAssigned', 'autoDeskUnresolved'] : []),
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
  /** Slug and name of every term, kept only for `--auto-desk`, which reads them as evidence. */
  const categoryTermByWpId = new Map<number, TermName>();
  const tagTermByWpId = new Map<number, TermName>();
  /** WordPress categories that left posts with nowhere to go, and how many each. */
  const orphanCategories = new Map<string, number>();

  /*
   * Read now, written later.
   *
   * Which categories are desks is decided from the terms alone, and everything that comes
   * before the storage check — which posts will be imported, which of their images to
   * fetch — needs only that decision. The writes wait until the check has passed: the
   * archive has 36.438 tags, and at Kal El's rate limit creating them is the better part
   * of an hour, which is not something to do first and then refuse the import over.
   */
  const categoryTerms: WpTerm[] = [];
  for await (const batch of source.categories()) categoryTerms.push(...batch);
  const tagTerms: WpTerm[] = [];
  for await (const batch of source.tags()) tagTerms.push(...batch);
  const authorTerms: WpAuthor[] = [];
  for await (const batch of source.authors()) authorTerms.push(...batch);

  for (const term of categoryTerms) {
    const slug = slugify(term.slug || term.name);
    categorySlugByWpId.set(term.id, slug);
    if (autoDesk) categoryTermByWpId.set(term.id, { slug, name: term.name });
    const desk = deskOf(slug, categoryOverrides);
    if (desk !== null) indexes.deskSlugByWpId.set(term.id, desk);
  }
  if (autoDesk) {
    for (const term of tagTerms) tagTermByWpId.set(term.id, { slug: slugify(term.slug || term.name), name: term.name });
  }

  async function writeTaxonomy(): Promise<void> {
    for (const term of categoryTerms) {
      const slug = slugify(term.slug || term.name);
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

    for (const term of tagTerms) {
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

    for (const author of authorTerms) {
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

  // ------------------------------------------------------------------- desks
  //
  // Decided once per post and remembered. The image pre-pass and the post phase must agree
  // on whether a post is imported at all, and a decision taken twice can come out twice.
  const deskDecisions = new Map<number, DeskDecision>();
  const decideDesk = (post: WpPost): DeskDecision => {
    let decision = deskDecisions.get(post.id);
    if (!decision) {
      decision = classifyDesk(deskSignalsOf(post, categoryTermByWpId, tagTermByWpId));
      deskDecisions.set(post.id, decision);
    }
    return decision;
  };

  /**
   * The Kal El category of a desk no WordPress category of this archive stood for.
   *
   * `--auto-desk` can file a post under a desk the taxonomy phase never created — the
   * archive has no Animes category at all. One create at a time per desk, so lanes that need
   * the same desk at the same moment wait for it instead of racing to make two.
   */
  const deskCategory = singleFlight(async (desk: string): Promise<string | null> => {
    const known = indexes.categoryBySlug.get(desk) ?? existingBySlug.categories.get(desk);
    if (known) return known;
    if (!target) {
      const placeholder = `dry:category:${desk}`;
      indexes.categoryBySlug.set(desk, placeholder);
      return placeholder;
    }
    const res = await target.createCategory(
      { name: isEditoriaSlug(desk) ? EDITORIA_NAMES[desk] : desk, slug: desk, description: null },
      idempotencyKey('category', `desk-${desk}`),
    );
    if (res.data?.id) {
      indexes.categoryBySlug.set(desk, res.data.id);
      return res.data.id;
    }
    summary.counts.inc('failed');
    summary.failures.push({ id: `category:${desk}`, reason: res.error ?? 'unknown' });
    return null;
  });

  const autoDeskFor = autoDesk
    ? async (post: WpPost): Promise<string | null> => {
        const { desk } = decideDesk(post);
        if (desk === null) return null;
        const categoryId = await deskCategory(desk);
        // Not "no evidence": the rule named a desk, and Kal El would not take its category.
        if (categoryId === null) {
          throw new CliError(
            `post ${post.id} belongs under ${desk} by --auto-desk, but that desk's category could not be created`,
          );
        }
        return categoryId;
      }
    : undefined;

  /** Whether a post will be filed under a desk — answered from the plan, before anything exists. */
  const willBeFiled = (post: WpPost): boolean =>
    post.categories.some((id) => indexes.deskSlugByWpId.has(id)) || (autoDesk && decideDesk(post).desk !== null);

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
   * The library is listed in full before any of it is sent: the storage check needs to
   * know what is still to upload, and the plan needs to know which body images the
   * library will answer for.
   */
  const library: WpMedia[] = [];
  if (!skipMedia) for await (const batch of source.media()) library.push(...batch);
  const transferable = library.filter((asset) => ALLOWED_ASSET_TYPES.has(asset.mime_type));

  // ----------------------------------------------------------------- uploads
  //
  // What --uploads holds of the library still to send. Measured before the plan, which
  // asks who uses the files that are missing.
  const libraryPending = transferable.filter(
    (asset) =>
      (alreadyImported.get(`wp:media:${asset.id}`) ?? state.mappings[mappingKey('media', asset.id)]) === undefined,
  );
  const measured = libraryPending.map((asset) => ({
    id: asset.id,
    url: asset.source_url,
    size: null as number | null,
  }));
  const measure = source.assetSize?.bind(source);
  if (measure && measured.length > 0) {
    await forEachConcurrent(measured, 16, async (entry) => {
      entry.size = await measure(entry.url).catch(() => null);
    });
  }
  const onDisk = tallyUploads(measured, maxAssetBytes);
  if (libraryPending.length > 0) {
    console.log(`[wp:import] uploads: ${describeUploads(onDisk.uploads, libraryPending.length)}`);
  }

  // -------------------------------------------------------------------- plan
  //
  // Only a run over the whole archive can say that no imported post uses a file: with
  // --since or --limit, a missing file fails the way it always did.
  const wholeArchive = since === undefined && limit === 0;
  const runPlan = await planRun({
    posts: source.posts(since),
    limit,
    willBeFiled,
    library: transferable,
    collectExternal: externalImages,
    missingOnDisk: wholeArchive && onDisk.uploads !== null ? new Set(onDisk.missing.map((file) => file.id)) : null,
    ...siteHost,
  });

  let externals: ExternalImage[] = runPlan.externalImages;
  if (externalImages) {
    summary.counts.inc('externalImagesFound', externals.length);
    console.log(
      `[wp:import] third-party images: ${externals.length} unique URLs on ${new Set(externals.map((i) => i.host)).size} hosts`,
    );
  }

  const duplicateOf = new Map(runPlan.duplicates.map((pair) => [pair.skippedId, pair]));
  if (duplicateOf.size > 0) {
    console.log(`[wp:import] duplicates: ${duplicateOf.size} posts are copies of an earlier post and will be skipped`);
  }

  // A missing file no imported post uses has nothing to lose; one an imported post uses
  // is a hole in that post, and fails as it always did.
  const missingFiles = {
    unused: wholeArchive ? onDisk.missing.filter((file) => !runPlan.missingUsedBy.has(file.id)) : [],
    used: onDisk.missing
      .filter((file) => runPlan.missingUsedBy.has(file.id))
      .map((file) => ({ ...file, usedBy: runPlan.missingUsedBy.get(file.id) ?? [] })),
  };

  // ----------------------------------------------------------------- storage
  let storage: { need: StorageNeed; uploads: UploadsOnDisk | null; verdict: string | null } | null = null;
  const externalPending = externals.filter(
    (image) =>
      (alreadyImported.get(image.externalKey) ?? state.mappings[mappingKey('external', image.hash)]) === undefined,
  ).length;
  if (libraryPending.length > 0 || externalPending > 0) {
    storage = { need: estimateNeed(onDisk.sizes, externalPending), uploads: onDisk.uploads, verdict: null };
    console.log(`[wp:import] storage: ${describeNeed(storage.need)}`);

    if (target) {
      if (values['skip-storage-check'] === true) {
        console.log('[wp:import] storage: check skipped (--skip-storage-check)');
      } else {
        const verdict = storageVerdict(storage.need, await target.mediaStorage());
        console.log(`[wp:import] storage: ${verdict.message}`);
        // Refused before the first upload, which is the only moment refusing is free.
        if (!verdict.ok) throw new CliError(`refusing to upload: ${verdict.message}`);
        storage.verdict = verdict.message;
      }
    }
  }
  libraryPending.length = 0;

  // ------------------------------------------------------------ taxonomy write
  await writeTaxonomy();
  // Written: the lists are dead weight for the rest of a run that reads 41.318 posts.
  categoryTerms.length = 0;
  tagTerms.length = 0;
  authorTerms.length = 0;

  // ------------------------------------------------------------ library upload
  if (!skipMedia) {
    const deps: AssetImportDeps = {
      source,
      target,
      indexes,
      state,
      summary,
      report,
      alreadyImported,
      maxAssetBytes,
      missingFiles: {
        unused: new Set(missingFiles.unused.map((file) => file.id)),
        usedBy: runPlan.missingUsedBy,
      },
    };
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
  const external = externalImages
    ? externalImagesSummary(externals, externalTallies, runPlan.unparseableExternal)
    : null;
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
    ...(autoDeskFor ? { autoDesk: autoDeskFor } : {}),
  };

  /** Whether each post a copy was taken from was imported in this run — decided once it has settled. */
  const keptIds = new Set(runPlan.duplicates.map((pair) => pair.keptId));
  const keptImported = new Map<number, boolean>();
  const copiesRead: DuplicatePair[] = [];

  const importOne = async (post: WpPost): Promise<void> => {
    try {
      const result = await importPost(post, context);
      summary.counts.inc(result);
      if (keptIds.has(post.id)) keptImported.set(post.id, true);
    } catch (err) {
      if (keptIds.has(post.id)) keptImported.set(post.id, false);
      if (err instanceof MissingDeskError) {
        for (const id of err.categories) {
          const slug = categorySlugByWpId.get(id);
          if (slug) orphanCategories.set(slug, (orphanCategories.get(slug) ?? 0) + 1);
        }
        // Counted in `noDesk` and listed in auto-desk.json. Failing the run over a decision
        // would also stop the import session before its idempotency pass.
        if (err.leftOut) return;
      }
      summary.counts.inc('failed');
      summary.failures.push({ id: `wp:post:${post.id}`, reason: err instanceof Error ? err.message : String(err) });
    }
  };

  for await (const batch of source.posts(since)) {
    const plan = planPostBatch(batch, slugsSeen, limit > 0 ? limit - processed : Number.POSITIVE_INFINITY, (postId) =>
      duplicateOf.has(postId),
    );
    processed += plan.taken;
    summary.counts.inc('read', plan.taken);
    for (const { post, slug, owner } of plan.collisions) {
      summary.counts.inc('slugCollision');
      summary.failures.push({
        id: `wp:post:${post.id}`,
        reason: `slug "${slug}" is already taken by wp:post:${owner}`,
      });
    }
    for (const copy of plan.duplicates) copiesRead.push(duplicateOf.get(copy.id) as DuplicatePair);
    for (const wave of plan.waves) await forEachConcurrent(wave, concurrency, importOne);
    // The whole batch has settled, so every post before the cursor is done.
    state.cursor = processed;
    await checkpoint.save();
    if (limit > 0 && processed >= limit) break;
  }

  /*
   * A copy is skipped only once the post it copies is in: settled here, after every batch,
   * because the lowest id of a group need not arrive first. If that post was not imported,
   * skipping its copy would lose the story silently — so the copy fails with it instead.
   */
  const skippedCopies: DuplicatePair[] = [];
  for (const pair of copiesRead) {
    if (keptImported.get(pair.keptId) === true) {
      summary.counts.inc('duplicatesSkipped');
      skippedCopies.push(pair);
      continue;
    }
    summary.counts.inc('failed');
    summary.failures.push({
      id: `wp:post:${pair.skippedId}`,
      reason: `a copy of wp:post:${pair.keptId}, which was not imported in this run: not imported either`,
    });
  }

  // ----------------------------------------------------------------- reports
  // A skipped copy is not imported, so its desk decision is not one the report should count.
  const desks = autoDesk
    ? autoDeskReport([...deskDecisions.values()].filter((decision) => !duplicateOf.has(decision.postId)))
    : null;
  if (desks) {
    summary.counts.inc('autoDeskAssigned', desks.counts.assigned);
    summary.counts.inc('autoDeskUnresolved', desks.counts.unresolved);
  }

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
        ...(storage ? { storage } : {}),
        ...(external
          ? {
              externalImages: {
                ...external,
                // The whole table is in external-images.json; here, the hosts that matter.
                byHost: external.byHost.slice(0, 15).map(({ samples: _samples, ...tally }) => tally),
              },
            }
          : {}),
        ...(desks ? { autoDesk: desks.counts } : {}),
        // Every one, not a sample: an operator deciding whether a gap matters needs the list.
        mediaMissing: {
          unused: missingFiles.unused,
          used: missingFiles.used,
        },
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

  if (desks) {
    const desksPath = path.join(outDir, 'auto-desk.json');
    await writeFile(desksPath, JSON.stringify(desks, null, 2), 'utf8');
    artefacts.push(desksPath);
  }

  // Written on every run, empty or not: `redirects:build` derives the same pairs from the
  // archive, and this is what the operator checks its redirects against.
  const duplicatesPath = path.join(outDir, 'duplicates.json');
  await writeFile(
    duplicatesPath,
    JSON.stringify(
      {
        note:
          'Posts publicados duas vezes — título normalizado e corpo idênticos a um post anterior importado. ' +
          'A cópia de id maior não é importada; seu endereço antigo é redirecionado por `pnpm redirects:build`.',
        duplicates: skippedCopies
          .sort((a, b) => a.skippedId - b.skippedId)
          .map(({ skippedId, keptId, legacyPath, keptLegacyPath }) => ({
            skippedId,
            keptId,
            legacyPath,
            keptLegacyPath,
          })),
      },
      null,
      2,
    ),
    'utf8',
  );
  artefacts.push(duplicatesPath);

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
  /** Copies of an earlier post: read, but neither imported nor given a slug to claim. */
  duplicates: WpPost[];
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
  isDuplicate: (postId: number) => boolean = () => false,
): PostBatchPlan {
  const first: WpPost[] = [];
  const later: WpPost[] = [];
  const collisions: PostBatchPlan['collisions'] = [];
  const duplicates: WpPost[] = [];
  let taken = 0;
  for (const post of batch) {
    if (taken >= capacity) break;
    taken += 1;
    // A copy's slug is its original's: letting it claim one would report a collision for
    // a post that is never written.
    if (isDuplicate(post.id)) {
      duplicates.push(post);
      continue;
    }
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
  return { waves: [first, later].filter((wave) => wave.length > 0), collisions, duplicates, taken };
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
  /**
   * Library files missing from `--uploads`, as the plan found them: those no imported post
   * uses are skipped, those one does fail — without a pointless attempt to read them.
   */
  missingFiles?: { unused: ReadonlySet<number>; usedBy: ReadonlyMap<number, readonly number[]> };
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
  // Absent from --uploads and shown by no post this run imports: nothing to transfer, and
  // nothing lost by not transferring it — the theme's demo images, in this archive.
  if (deps.missingFiles?.unused.has(asset.id)) {
    summary.counts.inc('mediaMissingUnused');
    return;
  }
  const usedBy = deps.missingFiles?.usedBy.get(asset.id);
  if (usedBy) {
    summary.counts.inc('failed');
    summary.failures.push({
      id: externalKey,
      reason: `file missing from --uploads, and used by ${usedBy.map((id) => `wp:post:${id}`).join(', ')}`,
    });
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
  /**
   * With `--auto-desk`: the Kal El category of the desk the post's own evidence points
   * to, or `null` when it points nowhere clearly. Consulted only when no WordPress
   * category of the post is a desk.
   */
  autoDesk?: (post: WpPost) => Promise<string | null>;
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
  // Only for a post WordPress filed under no desk at all. A post whose desk category
  // failed to be created has a desk, and keywords must not move it to another one.
  const unfiled = taxonomy.categories.length === 0 && !post.categories.some((id) => indexes.deskSlugByWpId.has(id));
  if (unfiled && ctx.autoDesk) {
    const categoryId = await ctx.autoDesk(post);
    if (categoryId) taxonomy.categories = [categoryId];
  }
  if (taxonomy.categories.length === 0) {
    // Not a warning. The portal drops an article with no desk from every listing and
    // from the sitemap, so importing it anyway produces something that exists in the CMS
    // and cannot be reached from the site — the failure mode that looks most like
    // success. 298 posts in this archive land here; `--category-map` is how they are
    // given a home.
    ctx.summary.counts.inc('noDesk');
    const leftOut = unfiled && ctx.autoDesk !== undefined;
    const why = !unfiled
      ? 'its desk category could not be created in Kal El'
      : leftOut
        ? '--auto-desk found no clear evidence of one: left out, listed in auto-desk.json'
        : 'its categories are not among the desks, and no --category-map entry covers them';
    throw new MissingDeskError(`post ${post.id} (${post.slug}) has no desk: ${why}`, post.categories, leftOut);
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
