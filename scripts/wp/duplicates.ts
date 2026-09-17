import { createHash } from 'node:crypto';

import { toPlainText } from '@mn/content';

/**
 * Posts published twice.
 *
 * The archive holds the same article more than once: 9883/9884, 9880/9886 and
 * 11001/11002 have identical titles and byte-identical bodies, published seconds apart,
 * differing only in a second upload of the same cover. Imported as they are, the second
 * copy of each either takes a URL of its own for a story the site already has, or — when
 * `slugify` makes the two slugs one — is refused by Kal El and fails the whole run.
 *
 * The rule is deliberately narrow: a post is a copy only when its normalised title *and*
 * its exact body equal those of another post that is imported, and the copy with the
 * lowest WordPress id is the one kept. Two different stories whose slugs merely collide
 * are not copies, and still fail as they did.
 */

/** The title as a reader sees it: tags and entities gone, whitespace collapsed, case ignored. */
export function normaliseTitle(title: string): string {
  return toPlainText(title).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The identity of a post's content: its normalised title, and the sha256 of its body's exact bytes. */
export function postFingerprint(post: { title: string; content: string }): string {
  const body = createHash('sha256').update(post.content, 'utf8').digest('hex');
  return createHash('sha256')
    .update(`${normaliseTitle(post.title)}\u0000${body}`, 'utf8')
    .digest('hex');
}

/** The path of a WordPress permalink — the URL search engines hold for the post. */
export function legacyPathOf(link: string): string {
  try {
    return new URL(link).pathname;
  } catch {
    return link;
  }
}

export interface DuplicateCandidate {
  id: number;
  fingerprint: string;
  legacyPath: string;
  /** The post's new address, when the caller knows it. */
  finalPath?: string;
}

export interface DuplicatePair {
  skippedId: number;
  keptId: number;
  legacyPath: string;
  keptLegacyPath: string;
  keptFinalPath?: string;
}

/**
 * Groups posts by fingerprint, in whatever order they arrive.
 *
 * Order matters to the answer — the lowest id is kept — but not to the input: the archive
 * yields posts by id, the REST source by modification date, and both must agree.
 */
export class DuplicateFinder {
  private readonly first = new Map<string, DuplicateCandidate>();
  private readonly more = new Map<string, DuplicateCandidate[]>();

  /** Records a post that will be imported; `true` when no post with its content was seen before. */
  add(candidate: DuplicateCandidate): boolean {
    if (!this.first.has(candidate.fingerprint)) {
      this.first.set(candidate.fingerprint, candidate);
      return true;
    }
    const group = this.more.get(candidate.fingerprint);
    if (group) group.push(candidate);
    else this.more.set(candidate.fingerprint, [candidate]);
    return false;
  }

  /** Every copy to skip, with the post it copies — the lowest id of its group. Lowest skipped id first. */
  pairs(): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    for (const [fingerprint, rest] of this.more) {
      const [kept, ...copies] = [this.first.get(fingerprint) as DuplicateCandidate, ...rest].sort(
        (a, b) => a.id - b.id,
      );
      if (!kept) continue;
      for (const copy of copies) {
        pairs.push({
          skippedId: copy.id,
          keptId: kept.id,
          legacyPath: copy.legacyPath,
          keptLegacyPath: kept.legacyPath,
          ...(kept.finalPath === undefined ? {} : { keptFinalPath: kept.finalPath }),
        });
      }
    }
    return pairs.sort((a, b) => a.skippedId - b.skippedId);
  }
}
