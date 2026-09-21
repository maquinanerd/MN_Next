import type { Image } from '@mn/content';

/**
 * The crops of a cover, as Google asks for an Article image.
 *
 * Three aspect ratios — 16:9, 4:3 and 1:1 — each at least 1200 px wide: that is what the
 * Article documentation recommends and what Discover needs for a large card. The 16:9 one is
 * also the `og:image`, as a JPEG, because Facebook and WhatsApp show no preview for the AVIF
 * the newsroom uploads. `app/media/[id]/[variant]/route.ts` renders them from the original.
 */
export const COVER_VARIANTS = {
  '16x9': { width: 1200, height: 675 },
  '4x3': { width: 1200, height: 900 },
  '1x1': { width: 1200, height: 1200 },
} as const;

export type CoverVariant = keyof typeof COVER_VARIANTS;

export function isCoverVariant(value: string): value is CoverVariant {
  return Object.hasOwn(COVER_VARIANTS, value);
}

/** A cover served by the media proxy: `/media/{uuid}`. */
const MEDIA_PATH = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Below this the original is too small to crop to 1200 px wide without turning to mush,
 * and it is used as it is.
 */
const MIN_SOURCE_WIDTH = 600;

/** One crop of a cover, or null when the cover is not a CMS image or is too small for one. */
export function coverVariant(
  image: Pick<Image, 'url' | 'width'>,
  variant: CoverVariant,
): { url: string; width: number; height: number } | null {
  const id = MEDIA_PATH.exec(image.url)?.[1];
  if (!id || image.width < MIN_SOURCE_WIDTH) return null;
  return { url: `/media/${id}/${variant}.jpg`, ...COVER_VARIANTS[variant] };
}
