/**
 * Slug rules (docs/04-rotas-e-slugs.md): lowercase ASCII, no accents, hyphen separated,
 * immutable after publication. A title can change; the slug does not follow it.
 */

/** Combining diacritical marks, left over after NFD normalisation. */
const DIACRITICS = /[̀-ͯ]/g;
/** Curly quotes and apostrophes, which must vanish rather than become a hyphen. */
const SMART_QUOTES = /[‘’“”]/g;

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(SMART_QUOTES, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 300 && SLUG_RE.test(value);
}

/**
 * Guards a slug that arrives from a URL segment before it reaches the CMS.
 *
 * Returns null for anything that is not a well-formed slug, so a route answers 404
 * instead of forwarding an attacker-controlled string into a query.
 */
export function safeSlugParam(value: string | undefined): string | null {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const lower = decoded.toLowerCase();
  return isValidSlug(lower) ? lower : null;
}

/** Reading time, derived from the body word count. Never typed in by an editor. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}
