/**
 * The old WordPress image URLs — `/wp-content/uploads/2025/07/nome-300x169.jpg` — and the
 * keys they may have in `data/legacy-media.tsv.gz`, the table `pnpm media-redirects:build`
 * writes from the dump and the import's state: upload path → Kal El media id.
 *
 * The table holds each attachment's own path and, for a `-scaled` or `-rotated` one, the
 * original's. The URLs found in the wild name one of those or a copy WordPress derived from
 * it — a size (`-300x169`), a `.webp` a plugin appended — so the keys to try are the path as
 * asked, then the original it was cut from. The month folder stays in every key: it is what
 * tells two `image-1.png` apart.
 *
 * Pure, so the build script and the route share it.
 */

export const MEDIA_TABLE_PATH = 'data/legacy-media.tsv.gz';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
/** A WebP a conversion plugin wrote next to the original: `foto.jpg.webp`. */
const PLUGIN_WEBP = /\.(jpe?g|png|gif)\.webp$/i;
/** The copy WordPress made at a registered size. */
const SIZE_SUFFIX = /-\d{2,5}x\d{2,5}$/;
/** The full-size copy WordPress keeps for a large (`-scaled`) or turned (`-rotated`) upload. */
const ORIGINAL_SUFFIX = /-(scaled|rotated)$/;

/** `2025/07/foto-scaled.jpg` → `2025/07/foto.jpg`: the name the sizes were cut under. */
export function originalOf(path: string): string {
  const ext = IMAGE_EXT.exec(path)?.[0];
  if (!ext) return path;
  return path.slice(0, -ext.length).replace(ORIGINAL_SUFFIX, '') + ext;
}

/**
 * The table keys an old upload URL may have, most likely first; null when the path is not
 * an image under `uploads/`. `segments` are the route's catch-all, already decoded by Next.
 */
export function uploadKeys(segments: readonly string[]): string[] | null {
  // `2025/07/nome.jpg`, or a bare `nome.jpg` from before month folders.
  const dated = segments.length === 3 && /^\d{4}$/.test(segments[0] ?? '') && /^\d{2}$/.test(segments[1] ?? '');
  if (!dated && segments.length !== 1) return null;
  const file = segments[segments.length - 1];
  if (!file || file.length > 255 || /[/\\\0]/.test(file)) return null;

  const plain = file.replace(PLUGIN_WEBP, (match) => match.slice(0, -'.webp'.length));
  const ext = IMAGE_EXT.exec(plain)?.[0];
  if (!ext) return null;

  const dir = dated ? `${segments[0]}/${segments[1]}/` : '';
  const requested = plain.slice(0, -ext.length);
  const sizeless = requested.replace(SIZE_SUFFIX, '');
  const original = sizeless.replace(ORIGINAL_SUFFIX, '');
  return [...new Set([requested, sizeless, original].map((base) => `${dir}${base}${ext}`))];
}
