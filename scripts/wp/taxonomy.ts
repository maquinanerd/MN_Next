import { readFile } from 'node:fs/promises';

import { DESK_SLUGS, slugify } from '@mn/content';

import { CliError } from './cli';

/**
 * WordPress taxonomy, mapped onto the portal's.
 *
 * The two do not have the same shape, and the archive is what made that concrete: this
 * WordPress carries **8.619 categories and 36.438 tags**, while the portal has six
 * desks. Importing categories one-to-one would create 8.619 route segments — `/noticias`,
 * `/netflix`, `/robert-de-niro` — and the approved information architecture says the
 * opposite: *sub-desks are tags, never route segments* (docs/04).
 *
 * So a WordPress category is a **desk** when its slug is one of the six, and a **tag**
 * otherwise. Nothing is discarded: `noticias`, on 32.781 posts, becomes a tag and stays
 * on every article that had it.
 *
 * Measured against the real archive: 41.020 of 41.318 published posts (99,3%) carry
 * exactly one desk, 190 carry two, and 298 carry none.
 */

export { DESK_SLUGS };

/**
 * Which desk wins when a post is filed under two.
 *
 * Most specific first. `reviews` leads because it is a *format* the portal renders with
 * its own template and its own index — a review of a film is a review before it is a
 * film — and the rest run from the narrowest medium to the broadest.
 *
 * This decides 190 of 41.318 posts (0,46%). It is written down rather than left to map
 * iteration order because a rule that picks silently is a rule nobody can check, and
 * `--category-map` overrides it per slug for the cases an editor disagrees with.
 */
export const DESK_PRECEDENCE: readonly string[] = ['reviews', 'animes', 'quadrinhos', 'games', 'series', 'filmes'];

export type CategoryMap = Map<string, string>;

/**
 * The operator's overrides: WordPress category slug -> desk slug.
 *
 * The file is optional and its absence is not an error — the default policy stands on
 * its own. What *is* an error is a mapping to something that is not a desk, because that
 * would file articles under a route that does not exist and they would 404 on their own
 * canonical URL.
 */
export async function loadCategoryMap(file: string): Promise<CategoryMap> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return new Map();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CliError(`${file} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CliError(`${file} must be an object of "wp-category-slug": "desk-slug"`);
  }
  const map: CategoryMap = new Map();
  for (const [from, to] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof to !== 'string' || !DESK_SLUGS.includes(to)) {
      throw new CliError(`${file}: "${from}" maps to "${String(to)}", which is not a desk (${DESK_SLUGS.join(', ')})`);
    }
    map.set(slugify(from), to);
  }
  return map;
}

/** Whether a WordPress category becomes a desk, or a tag alongside the rest. */
export function classifyCategory(slug: string, overrides: CategoryMap = new Map()): 'desk' | 'tag' {
  return DESK_SLUGS.includes(slug) || overrides.has(slug) ? 'desk' : 'tag';
}

/** The desk a WordPress category slug stands for, if it stands for one. */
export function deskOf(slug: string, overrides: CategoryMap = new Map()): string | null {
  if (DESK_SLUGS.includes(slug)) return slug;
  return overrides.get(slug) ?? null;
}

/**
 * The one desk a post belongs to.
 *
 * `null` means the post has no desk, which is not a detail to smooth over: the portal
 * drops an article with no desk from every listing and from the sitemap, so importing it
 * anyway produces something that exists and cannot be found. The caller reports it.
 */
export function deskFor(categorySlugs: readonly string[], overrides: CategoryMap = new Map()): string | null {
  const desks = new Set<string>();
  for (const slug of categorySlugs) {
    const desk = deskOf(slug, overrides);
    if (desk) desks.add(desk);
  }
  if (desks.size === 0) return null;
  for (const candidate of DESK_PRECEDENCE) if (desks.has(candidate)) return candidate;
  // A desk the precedence list has never heard of: `site.ts` grew and this did not.
  return [...desks][0] ?? null;
}
