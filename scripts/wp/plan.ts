import type { Image } from '@mn/content';

import { DuplicateFinder, legacyPathOf, postFingerprint, type DuplicatePair } from './duplicates';
import { ExternalImageCollector, type ExternalImage } from './external-images';
import type { WpMedia, WpPost } from './source';
import { emptyReport, htmlToBlocks, shortcodeAssetRef } from './transform';

/** WordPress serves several sizes of the same asset; they all map to one original. */
export function canonicalAssetUrl(url: string): string {
  return url.replace(/-\d+x\d+(\.[a-z]{3,4})$/i, '$1');
}

export interface PlanOptions {
  /** The posts the run will import, in batches, as the source yields them. */
  posts: AsyncIterable<WpPost[]>;
  /** `--limit`; 0 for none. */
  limit: number;
  /** Whether a post will be imported at all — filed under a desk, by its categories or by `--auto-desk`. */
  willBeFiled: (post: WpPost) => boolean;
  /** The library assets of transferable types. */
  library: readonly WpMedia[];
  /** `--external-images`: collect the third-party images the imported posts show. */
  collectExternal: boolean;
  /** Library assets whose files are missing from `--uploads`; `null` when who uses them is not to be asked. */
  missingOnDisk: ReadonlySet<number> | null;
  siteHost?: string;
}

export interface RunPlan {
  /** Later copies of an imported post, lowest skipped id first. */
  duplicates: DuplicatePair[];
  externalImages: ExternalImage[];
  unparseableExternal: number;
  /** Each missing library file an imported post uses — as cover, body image or gallery — and those posts. */
  missingUsedBy: Map<number, number[]>;
}

/**
 * One pass over the posts before anything is written.
 *
 * What the run needs to know about the whole archive and cannot learn one post at a time:
 * which posts are copies of an earlier one (the lowest id of a group can arrive last),
 * which third-party images the imported posts show, and which of the files missing from
 * `--uploads` an imported post actually uses. The last two run the real transform, with
 * a resolver that answers for the library as it will be once imported, so what is
 * collected is exactly what the post phase will look up.
 */
export async function planRun(opts: PlanOptions): Promise<RunPlan> {
  const finder = new DuplicateFinder();
  const collector = opts.collectExternal ? new ExternalImageCollector() : null;
  const missing = opts.missingOnDisk ?? new Set<number>();
  const trackMissing = missing.size > 0;

  // Canonical URL and gallery placeholder -> the assets behind them. More than one asset
  // can fold into one canonical URL; all of them count as used, which errs strict.
  const libraryIds = new Map<string, number[]>();
  if (collector || trackMissing) {
    const index = (key: string, id: number): void => {
      const ids = libraryIds.get(key);
      if (ids) ids.push(id);
      else libraryIds.set(key, [id]);
    };
    for (const asset of opts.library) {
      index(canonicalAssetUrl(asset.source_url), asset.id);
      index(shortcodeAssetRef(asset.id), asset.id);
    }
  }
  const planned: Image = { url: '/media/planned', width: 1200, height: 675, alt: '' };
  const usesByPost = new Map<number, number[]>();

  let read = 0;
  scan: for await (const batch of opts.posts) {
    for (const post of batch) {
      if (opts.limit > 0 && read >= opts.limit) break scan;
      read += 1;
      // A post that will not be imported: its images are not worth hosting, its files not needed.
      if (!opts.willBeFiled(post)) continue;
      const firstCopy = finder.add({
        id: post.id,
        fingerprint: postFingerprint(post),
        legacyPath: legacyPathOf(post.link),
      });
      if (!collector && !trackMissing) continue;

      const uses: number[] = [];
      if (trackMissing && missing.has(post.featured_media)) uses.push(post.featured_media);
      htmlToBlocks(post.content, {
        postId: post.id,
        report: emptyReport(),
        resolveImage: (src) => {
          const ids = libraryIds.get(src) ?? libraryIds.get(canonicalAssetUrl(src));
          if (!ids) return null;
          for (const id of ids) if (missing.has(id)) uses.push(id);
          return planned;
        },
        ...(opts.siteHost ? { siteHost: opts.siteHost } : {}),
        // A later copy shows exactly the same images: collecting them again would only
        // inflate the occurrence counts.
        ...(collector && firstCopy ? { onUnresolvedImage: collector.listener(post.id) } : {}),
      });
      if (uses.length > 0) usesByPost.set(post.id, uses);
    }
  }

  const duplicates = finder.pairs();
  const skipped = new Set(duplicates.map((pair) => pair.skippedId));
  const missingUsedBy = new Map<number, number[]>();
  for (const [postId, ids] of usesByPost) {
    // A copy is not imported, so what it alone uses is not needed — its cover, typically.
    if (skipped.has(postId)) continue;
    for (const id of new Set(ids)) {
      const posts = missingUsedBy.get(id);
      if (posts) posts.push(postId);
      else missingUsedBy.set(id, [postId]);
    }
  }

  return {
    duplicates,
    externalImages: collector?.images() ?? [],
    unparseableExternal: collector?.unparseable ?? 0,
    missingUsedBy,
  };
}
