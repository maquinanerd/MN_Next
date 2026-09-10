/**
 * TypeScript mirror of the CSS tokens. Only what code has to compute with lives here —
 * breakpoints for `next/image` `sizes`, and the ad formats. Colour stays in CSS: a hex in
 * TypeScript is how a component ends up knowing it is red.
 */

/** Viewports the design is verified at (kit docs/06 and the Definition of Done). */
export const VIEWPORTS = { mobile: 390, tablet: 768, laptop: 1024, desktop: 1440 } as const;

/** The prototypes' container-query thresholds, as the first width *above* each one. */
export const BREAKPOINTS = { tab: 761, desk: 901, lg: 1101, nav: 1181, wide: 1241 } as const;

/** Canvas: 1500px max, 68px margins (16px on mobile), 40px grid gap. */
export const CANVAS = { max: 1500, margin: 68, marginMobile: 16, gap: 40 } as const;

/**
 * `sizes` for each image role, derived from the grid: a 1500px canvas less 136px of margin
 * is 1364px of content; a 4-column grid with 40px gaps makes one column ~311px.
 */
export const SIZES = {
  hero: '(max-width: 760px) 100vw, (max-width: 1500px) 75vw, 1100px',
  overlay: '(max-width: 760px) 100vw, (max-width: 1500px) 25vw, 360px',
  big: '(max-width: 760px) 100vw, (max-width: 1500px) 50vw, 660px',
  card: '(max-width: 760px) 100vw, (max-width: 1500px) 25vw, 320px',
  row: '(max-width: 760px) 100vw, 296px',
  video: '(max-width: 760px) 62vw, (max-width: 1500px) 25vw, 320px',
  feature: '(max-width: 1500px) 100vw, 1364px',
  cover: '100vw',
  figure: '(max-width: 900px) 100vw, 944px',
  related: '(max-width: 760px) 100vw, 280px',
  product: '(max-width: 900px) 100vw, 200px',
  avatar: '52px',
} as const;

export type ImageRole = keyof typeof SIZES;

/** Ad formats in use (kit docs/05). The reserved box keeps these dimensions even empty. */
export const AD_FORMATS = {
  '728x90': { width: 728, height: 90 },
  '300x250': { width: 300, height: 250 },
  '300x600': { width: 300, height: 600 },
  '970x250': { width: 970, height: 250 },
} as const;

export type AdFormato = keyof typeof AD_FORMATS;
