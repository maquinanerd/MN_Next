/**
 * When the WordPress archive was written into Kal El.
 *
 * An import session rewrites every article it touches, so the `updatedAt` of each of them is
 * the moment of the import — for 40.907 articles published over fourteen months. Declared
 * as `dateModified` and as the sitemap's `lastmod`, that reads as an editorial update of the
 * whole archive at once: the artificial freshness Google's guidelines tell publishers not to
 * fake, and a `lastmod` Google learns to ignore for the whole site.
 *
 * Bounded, and wide on purpose: an edit the newsroom made inside a window is shown as the
 * publication date instead, which errs on the side of claiming less.
 */
export const IMPORT_WINDOWS: readonly (readonly [from: string, to: string])[] = [
  // First session: 2026-09-17, 10:02 to 18:51 BRT.
  ['2026-09-16T00:00:00Z', '2026-09-18T12:00:00Z'],
  // Second session, which repairs the first and proves it idempotent.
  ['2026-09-21T00:00:00Z', '2026-09-30T00:00:00Z'],
];

export function inImportWindow(iso: string): boolean {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  return IMPORT_WINDOWS.some(([from, to]) => at >= Date.parse(from) && at < Date.parse(to));
}

/**
 * The last change a reader would call a change.
 *
 * `updatedAt`, unless the only thing that changed the article since it was published was an
 * import — then the publication date, which is when the text last really changed as far as
 * anyone can tell.
 */
export function editorialUpdatedAt(article: { publishedAt: string | null; updatedAt: string }): string {
  const published = article.publishedAt ?? article.updatedAt;
  if (!article.publishedAt) return article.updatedAt;
  if (Date.parse(article.updatedAt) <= Date.parse(published)) return published;
  return inImportWindow(article.updatedAt) && !inImportWindow(published) ? published : article.updatedAt;
}
