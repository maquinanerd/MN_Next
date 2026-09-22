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

/**
 * The version of the rendering. A crop is cached for a year by every layer between here and
 * the reader, so a change to what the route draws — size, quality, crop strategy — ships
 * under a new name, never over the old one. Bump it with any such change.
 */
export const RENDITION_VERSION = 1;

/**
 * What the route renders: one of the crops, or `social` — an image the newsroom made for
 * sharing, re-encoded as a 1200 px JPEG with its own proportions, never cropped.
 */
export type Rendition = CoverVariant | 'social';

/** `16x9-v1.jpg`, the file name a rendition is served under. */
export function renditionFile(rendition: Rendition): string {
  return `${rendition}-v${RENDITION_VERSION}.jpg`;
}

/** The rendition a file name asks for, or null for any other name — an old version included. */
export function parseRenditionFile(file: string): Rendition | null {
  const suffix = `-v${RENDITION_VERSION}.jpg`;
  if (!file.endsWith(suffix)) return null;
  const name = file.slice(0, -suffix.length);
  return name === 'social' || isCoverVariant(name) ? name : null;
}

/** Width of the social rendition, which keeps the proportions of the image it comes from. */
export const SOCIAL_WIDTH = 1200;

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
  return { url: `/media/${id}/${renditionFile(variant)}`, ...COVER_VARIANTS[variant] };
}

/**
 * An image made for sharing, as a JPEG of at most 1200 px wide in its own proportions — the
 * newsroom composed it, often with text near the edges, and a crop would cut into it. Null
 * when it is not a CMS image, is too small, or its size is unknown.
 */
export function socialVariant(
  image: Pick<Image, 'url' | 'width' | 'height'>,
): { url: string; width: number; height: number } | null {
  const id = MEDIA_PATH.exec(image.url)?.[1];
  if (!id || image.width < MIN_SOURCE_WIDTH || !(image.height > 0)) return null;
  const width = Math.min(SOCIAL_WIDTH, image.width);
  return {
    url: `/media/${id}/${renditionFile('social')}`,
    width,
    height: Math.round((image.height * width) / image.width),
  };
}
