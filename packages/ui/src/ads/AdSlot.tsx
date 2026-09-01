import type { CSSProperties } from 'react';

/**
 * Ad slot.
 *
 * `minHeight` is a required prop, not an option: an ad that arrives into an unreserved
 * box is the single largest source of CLS on a news site (docs/07). The reservation is
 * applied inline so it exists in the first byte of HTML, before any stylesheet or script.
 *
 * The element is inert to the keyboard - it is never focusable and carries
 * `aria-hidden`, because "Publicidade / 970×90" is not something a screen-reader user
 * needs to tab through. Brand-safety suppression is decided on the server by the caller
 * (`isBrandUnsafe`), never in the browser.
 */

export type AdSlotName = 'leaderboard' | 'sidebar-sticky' | 'in-article' | 'feed' | 'mobile-anchor';

export interface AdSlotProps {
  id: string;
  slot: AdSlotName;
  /** Space reservation in px. Required. */
  minHeight: number;
  sizes?: [number, number][];
  label?: boolean;
  sticky?: boolean;
  /** Server-derived GAM targeting. Rendered as data attributes, read by the loader. */
  targeting?: Record<string, string | string[]>;
}

function serialiseTargeting(targeting: Record<string, string | string[]> | undefined): string | undefined {
  if (!targeting) return undefined;
  const entries = Object.entries(targeting).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]);
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : undefined;
}

export function AdSlot({ id, slot, minHeight, sizes, label = true, sticky = false, targeting }: AdSlotProps) {
  const style: CSSProperties = { minHeight };
  const className = ['mn-ad', sticky ? 'mn-ad--sticky' : '', slot === 'mobile-anchor' ? 'mn-ad--anchor' : '']
    .filter(Boolean)
    .join(' ');

  const sizeLabel = sizes?.map(([w, h]) => `${w} × ${h}`).join(' · ');

  return (
    <div
      className={className}
      style={style}
      id={id}
      data-ad-slot={slot}
      data-ad-sizes={sizes ? JSON.stringify(sizes) : undefined}
      data-ad-targeting={serialiseTargeting(targeting)}
      aria-hidden="true"
    >
      {label ? <span className="mn-ad__label">Publicidade</span> : null}
      {sizeLabel ? <span className="mn-ad__placeholder">{sizeLabel}</span> : null}
    </div>
  );
}

/** The four approved placements, with their reservations (docs/07). */
export const AD_SLOTS = {
  leaderboard: {
    slot: 'leaderboard' as const,
    minHeight: 90,
    sizes: [
      [970, 90],
      [728, 90],
      [320, 50],
    ] as [number, number][],
  },
  sidebar: {
    slot: 'sidebar-sticky' as const,
    minHeight: 600,
    sizes: [
      [300, 600],
      [300, 250],
    ] as [number, number][],
  },
  inArticle: {
    slot: 'in-article' as const,
    minHeight: 250,
    sizes: [
      [728, 90],
      [336, 280],
    ] as [number, number][],
  },
  feed: { slot: 'feed' as const, minHeight: 250, sizes: [[300, 250]] as [number, number][] },
  anchor: { slot: 'mobile-anchor' as const, minHeight: 50, sizes: [[320, 50]] as [number, number][] },
} as const;
