/**
 * When the WordPress archive was written into Kal El.
 *
 * An import session rewrites every article it touches, so the `updatedAt` of each of them is
 * the moment of the import — for 40.907 articles published over fourteen months. Declared
 * as `dateModified` and as the sitemap's `lastmod`, that reads as an editorial update of the
 * whole archive at once: the artificial freshness Google's guidelines tell publishers not to
 * fake, and a `lastmod` Google learns to ignore for the whole site.
 *
 * The windows apply only to an article the import wrote (`isImported`): a story the newsroom
 * publishes in Kal El keeps every edit, whenever it is made. Wide on purpose — an edit to an
 * imported article inside a window is shown as the publication date instead, which errs on
 * the side of claiming less. The second window is open until the second session has run;
 * then it is narrowed to that session's real times (docs/migration/DECISIONS.md §7.20).
 */
export const IMPORT_WINDOWS: readonly (readonly [from: string, to: string])[] = [
  // First session: 2026-09-17, 10:02 to 18:51 BRT.
  ['2026-09-16T00:00:00Z', '2026-09-18T12:00:00Z'],
  // Second session, which repairs the first and proves it idempotent. Not run yet.
  ['2026-09-21T00:00:00Z', '2026-10-31T00:00:00Z'],
];

export function inImportWindow(iso: string): boolean {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return IMPORT_WINDOWS.some(([from, to]) => at >= Date.parse(from) && at < Date.parse(to));
}

/** An article the WordPress import wrote: its external key names the post it came from. */
export function isImported(externalKey: string | null | undefined): boolean {
  return typeof externalKey === 'string' && externalKey.startsWith('wp:post:');
}

/**
 * Whether the last write to an article was an import session rather than an editor: only for
 * an imported article, and only inside a window. For one of those every write in a window is
 * the import — even for a post WordPress published on the day of the first session.
 */
export function lastWriteWasImport(article: { externalKey: string | null; updatedAt: string }): boolean {
  return isImported(article.externalKey) && inImportWindow(article.updatedAt);
}

/**
 * The last change a reader would call a change.
 *
 * `updatedAt`, unless the only thing that changed the article since it was published was an
 * import — then the publication date, which is when the text last really changed as far as
 * anyone can tell.
 */
export function editorialUpdatedAt(article: {
  publishedAt: string | null;
  updatedAt: string;
  externalKey: string | null;
}): string {
  if (!article.publishedAt) return article.updatedAt;
  if (Date.parse(article.updatedAt) <= Date.parse(article.publishedAt)) return article.publishedAt;
  return lastWriteWasImport(article) ? article.publishedAt : article.updatedAt;
}
