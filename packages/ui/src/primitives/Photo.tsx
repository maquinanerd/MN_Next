import Image from 'next/image';

import { SIZES, type ImageRole } from '@mn/tokens';

import type { Imagem } from '../model';

/**
 * Every image goes through here, always as `fill` inside a box that already reserves its
 * aspect ratio — so an image can never contribute to layout shift — and always with a
 * `sizes` taken from the grid, so a phone never downloads a desktop asset.
 *
 * `decorativa` sets `alt=""`: a card thumbnail sits beside a headline that already names
 * the link, and reading the photo description first would only delay it (docs/06).
 */
export function Photo({
  imagem,
  uso,
  priority = false,
  decorativa = false,
  className,
}: {
  imagem: Imagem;
  /** Which grid slot the image fills — decides its `sizes`. */
  uso: ImageRole;
  priority?: boolean;
  decorativa?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={imagem.url}
      alt={decorativa ? '' : imagem.alt}
      fill
      sizes={SIZES[uso]}
      priority={priority}
      className={className ?? 'object-cover'}
    />
  );
}

/** The translucent play disc the prototypes put on video thumbnails. */
export function PlayBadge({ size, icon }: { size: 30 | 34 | 48; icon: 11 | 12 | 16 }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/35 text-white"
      style={{ width: size, height: size }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor" focusable="false">
        <path d="M8 5l12 7-12 7z" />
      </svg>
    </span>
  );
}
