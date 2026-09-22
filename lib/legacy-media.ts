/**
 * The old WordPress image URLs — `/wp-content/uploads/2025/07/nome-300x169.jpg` — and the
 * file names Kal El may have stored that image under.
 *
 * The import uploaded each image under the basename of its original URL, cleaned by Kal
 * El's `sanitizeFilename`. The URLs found in the wild name that original or one of the
 * copies WordPress derived from it: a size (`-300x169`), the `-scaled` or `-rotated`
 * original WordPress keeps for large or turned photos, a `.webp` a plugin appended. Each is
 * the same picture; all of them are sent to it.
 */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
/** A WebP a conversion plugin wrote next to the original: `foto.jpg.webp`. */
const PLUGIN_WEBP = /\.(jpe?g|png|gif)\.webp$/i;
/** The copy WordPress made at a registered size. */
const SIZE_SUFFIX = /-\d{2,5}x\d{2,5}$/;
/** The full-size copy WordPress keeps for a large (`-scaled`) or turned (`-rotated`) upload. */
const ORIGINAL_SUFFIX = /-(scaled|rotated)$/;

/** Kal El's `sanitizeFilename`, so a name compares the way the CMS stored it. */
export function sanitizeFilename(raw: string): string {
  const base = raw.replace(/\\/g, '/').split('/').pop() ?? '';
  const clean = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return clean || 'file';
}

function decoded(segment: string): string | null {
  if (!segment.includes('%')) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * What to look for: `names`, most likely first, and `stem`, the part every one of them
 * contains, for a single search. Null when the path is not an image under `uploads/`.
 */
export function legacyUploadNames(segments: readonly string[]): { stem: string; names: string[] } | null {
  // `2025/07/nome.jpg`, or a bare `nome.jpg` from a site that never used month folders.
  const shapeOk =
    (segments.length === 3 && /^\d{4}$/.test(segments[0] ?? '') && /^\d{2}$/.test(segments[1] ?? '')) ||
    segments.length === 1;
  if (!shapeOk) return null;
  const raw = segments[segments.length - 1];
  if (raw === undefined) return null;
  const file = decoded(raw);
  if (!file || file.length > 255) return null;

  const plain = file.replace(PLUGIN_WEBP, (match) => match.slice(0, -'.webp'.length));
  const ext = IMAGE_EXT.exec(plain)?.[0];
  if (!ext) return null;

  const requested = plain.slice(0, -ext.length);
  const sizeless = requested.replace(SIZE_SUFFIX, '');
  const original = sizeless.replace(ORIGINAL_SUFFIX, '');
  const bases = [requested, sizeless, original, `${original}-scaled`, `${original}-rotated`];
  const names = [...new Set(bases.map((base) => sanitizeFilename(`${base}${ext}`)))];

  const stem = sanitizeFilename(original);
  // Too short a stem would match half the library in one search.
  if (stem.length < 3) return null;
  return { stem, names };
}
