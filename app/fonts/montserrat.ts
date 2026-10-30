import localFont from 'next/font/local';

import './montserrat-fallback.css';

/**
 * Montserrat — the family the logo is drawn in (kit docs/01) — from files in this folder,
 * so neither the build nor a reader's browser ever asks Google Fonts for it.
 *
 * The `.woff2` files are the ones Google Fonts served `next/font/google` for this family
 * (v31, byte for byte): one variable file per script, each limited to its characters by a
 * `unicode-range`, which is how the browser knows which file a character needs. `next/font/local`
 * takes one `unicode-range` per call, so each script is its own call, all under the one family
 * name `Montserrat`. They are declared in Google's order: where two ranges share a character,
 * the face declared last wins, and that is latin. Only latin and latin-ext are preloaded,
 * as before.
 *
 * The weight is a range because the files are variable fonts; the six weights the system
 * uses (300–800) render exactly as the six faces Google declared for them.
 *
 * `Montserrat Fallback` is the size-adjusted Arial shown until the files arrive and for any
 * character none of them has. It lives in `montserrat-fallback.css`, with the metrics
 * `next/font/google` used, rather than `adjustFontFallback`: that one measures the variable
 * file's default instance, which is Thin, and would come out narrower than Regular.
 *
 * Every call declares the same `--font-montserrat`, so the classes can go on `<html>` in any
 * order; putting all five there is what brings each script's `@font-face` into the page.
 *
 * Licence: SIL Open Font License 1.1 (`OFL.txt`).
 */

const cyrillicExt = localFont({
  src: './montserrat-cyrillic-ext.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
  preload: false,
  declarations: [
    { prop: 'font-family', value: 'Montserrat' },
    { prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' },
  ],
  adjustFontFallback: false,
  fallback: ['Montserrat Fallback'],
  variable: '--font-montserrat',
});

const cyrillic = localFont({
  src: './montserrat-cyrillic.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
  preload: false,
  declarations: [
    { prop: 'font-family', value: 'Montserrat' },
    { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' },
  ],
  adjustFontFallback: false,
  fallback: ['Montserrat Fallback'],
  variable: '--font-montserrat',
});

const vietnamese = localFont({
  src: './montserrat-vietnamese.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
  preload: false,
  declarations: [
    { prop: 'font-family', value: 'Montserrat' },
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
    },
  ],
  adjustFontFallback: false,
  fallback: ['Montserrat Fallback'],
  variable: '--font-montserrat',
});

const latinExt = localFont({
  src: './montserrat-latin-ext.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
  declarations: [
    { prop: 'font-family', value: 'Montserrat' },
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
  adjustFontFallback: false,
  fallback: ['Montserrat Fallback'],
  variable: '--font-montserrat',
});

const latin = localFont({
  src: './montserrat-latin.woff2',
  weight: '300 800',
  style: 'normal',
  display: 'swap',
  declarations: [
    { prop: 'font-family', value: 'Montserrat' },
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  adjustFontFallback: false,
  fallback: ['Montserrat Fallback'],
  variable: '--font-montserrat',
});

/** The classes for `<html>`: each declares `--font-montserrat` and carries one script's file. */
export const montserratVariable = [cyrillicExt, cyrillic, vietnamese, latinExt, latin]
  .map((font) => font.variable)
  .join(' ');
