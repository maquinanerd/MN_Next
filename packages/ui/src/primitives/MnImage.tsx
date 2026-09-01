import NextImage from 'next/image';
import type { Image as DomainImage } from '@mn/content';

/**
 * Every image on the site goes through here.
 *
 * Two invariants it enforces:
 *  - the container reserves the aspect ratio before the bytes arrive, so an image can
 *    never contribute to CLS;
 *  - `alt` is always present. An empty string is legitimate for decorative art inside an
 *    already-labelled link, and is spelled explicitly rather than omitted.
 */

export interface MnImageProps {
  image: DomainImage;
  sizes: string;
  /** Only the one above-the-fold cover per page. More preloads help nothing. */
  priority?: boolean;
  /** Overrides the alt from the CMS - used for decorative art inside a titled link. */
  alt?: string;
  className?: string;
  fill?: boolean;
}

export function MnImage({ image, sizes, priority = false, alt, className, fill = true }: MnImageProps) {
  const resolvedAlt = alt ?? image.alt ?? '';
  const objectPosition = image.focalPoint
    ? `${Math.round(image.focalPoint.x * 100)}% ${Math.round(image.focalPoint.y * 100)}%`
    : undefined;

  if (!fill) {
    return (
      <NextImage
        src={image.url}
        alt={resolvedAlt}
        width={image.width}
        height={image.height}
        sizes={sizes}
        priority={priority}
        {...(image.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: image.blurDataURL } : {})}
        {...(className ? { className } : {})}
        {...(objectPosition ? { style: { objectPosition } } : {})}
      />
    );
  }

  return (
    <NextImage
      src={image.url}
      alt={resolvedAlt}
      fill
      sizes={sizes}
      priority={priority}
      {...(image.blurDataURL ? { placeholder: 'blur' as const, blurDataURL: image.blurDataURL } : {})}
      {...(className ? { className } : {})}
      {...(objectPosition ? { style: { objectPosition } } : {})}
    />
  );
}

/** Standard `sizes` strings, so a grid never downloads a desktop asset on a phone. */
export const SIZES = {
  hero: '(max-width: 760px) 100vw, (max-width: 1100px) 66vw, 720px',
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px',
  cardSm: '(max-width: 640px) 50vw, 220px',
  thumb: '128px',
  full: '100vw',
  poster: '(max-width: 640px) 45vw, 220px',
  aside: '300px',
} as const;
