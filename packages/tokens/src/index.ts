/**
 * TypeScript mirror of the CSS tokens. Only values that code genuinely needs to compute
 * with live here (breakpoints for `sizes`, aspect ratios, the author palette). Colour
 * belongs in CSS: duplicating a hex in TS is how a component ends up knowing it is red.
 */

export type Appearance = 'light' | 'dark';
export type Brand = 'mn' | 'cinerie';

export const APPEARANCES = ['light', 'dark'] as const;
export const BRANDS = ['mn', 'cinerie'] as const;

export const THEME_COOKIE = 'mn-theme';

/** Viewports the design is verified at (docs/08-definition-of-done.md). */
export const BREAKPOINTS = { mobile: 390, tablet: 768, laptop: 1024, desktop: 1440 } as const;

export const SHELL_MAX = 1440;
export const EDITORIAL_MAX = 1240;

/** Card image ratios taken from the prototypes. */
export const RATIOS = {
  hero: '576 / 324',
  card: '343 / 193',
  cardSm: '307 / 172',
  cardXs: '288 / 162',
  wide: '16 / 9',
  ultrawide: '21 / 9',
  poster: '2 / 3',
} as const;

export type Ratio = keyof typeof RATIOS;

/**
 * Author avatar colour, assigned by a deterministic hash so SSR and the client agree.
 * A per-render random colour flickers on hydration.
 */
export const AUTHOR_COLOR_VARS = [
  'var(--mn-author-1)',
  'var(--mn-author-2)',
  'var(--mn-author-3)',
  'var(--mn-author-4)',
  'var(--mn-author-5)',
] as const;

export function authorColorVar(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AUTHOR_COLOR_VARS[hash % AUTHOR_COLOR_VARS.length] as string;
}

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string)[0]}${(parts[parts.length - 1] as string)[0]}`.toUpperCase();
}

/** Ad slot space reservations, in px. `minHeight` is a required prop of `<AdSlot />`. */
export const AD_RESERVATION = {
  leaderboard: 90,
  'sidebar-sticky': 600,
  'in-article': 250,
  feed: 250,
  'mobile-anchor': 50,
} as const;

export type AdSlotName = keyof typeof AD_RESERVATION;
