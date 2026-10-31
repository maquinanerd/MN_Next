/**
 * OpaPreço Ads configuration, read from the build's public environment.
 *
 * OpaPreço decides everything about an ad — the offer, the component, the price, the
 * affiliate link, the tracking — and its script draws it into an `<op-slot>`. The portal
 * only says where the slot is and what page it is on, so the whole configuration is two
 * values:
 *
 *  - `NEXT_PUBLIC_OPAPRECO_ADS_ENABLED` — on unless it reads `false`. Turning it off makes
 *    every slot render nothing and drops the script, the stylesheet and the CSP hosts from
 *    the build, without a code change.
 *  - `NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT` — the origin that serves `/v1/ads/*`. Production
 *    leaves it unset (`https://opapreco.com.br`). It exists for a local stand-in: OpaPreço
 *    answers 403 to any origin outside maquinanerd.com.br, so a development build can only
 *    see an ad through a server of its own on the loopback. Anything else that is not an
 *    https origin falls back to the default, so a typo can never send readers' requests
 *    somewhere new.
 *
 * The site key is not configuration: it is the name this site was registered and
 * approved under in OpaPreço, and it is the same in every environment.
 *
 * The references to `process.env` are literal on purpose: Next inlines only literal
 * `process.env.NEXT_PUBLIC_*` reads, so a computed key would resolve to `undefined` in
 * the browser bundle.
 */

export const OPAPRECO_SITE_KEY = 'maquina-nerd';

const DEFAULT_ENDPOINT = 'https://opapreco.com.br';

/** Where a Shopee product photo lives when OpaPreço has not mirrored it. */
const SHOPEE_IMAGES = 'https://cf.shopee.com.br';

/** The five slots OpaPreço knows; its script collapses an `<op-slot>` named anything else. */
export const OPAPRECO_SLOTS = [
  'article-top',
  'article-inline-01',
  'article-inline-02',
  'article-bottom',
  'sidebar',
] as const;

export type OpaPrecoSlot = (typeof OPAPRECO_SLOTS)[number];

/**
 * What a slot tells OpaPreço about the page, besides the canonical URL and the title its
 * script reads from `<head>` itself. Nothing about the reader: no cookie, no id.
 */
export interface ContextoDoAnuncio {
  /** The article's category slug ("games"). */
  secao?: string;
  /** Its tag slugs, for matching offers to the subject. */
  tags?: string[];
  /** The article's id, so OpaPreço never repeats an offer within one article. */
  conteudo?: string;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Whether this build serves OpaPreço Ads at all. */
export function opaPrecoEnabled(): boolean {
  return clean(process.env.NEXT_PUBLIC_OPAPRECO_ADS_ENABLED).toLowerCase() !== 'false';
}

/** The origin slots ask for ads: https, or http only on the loopback. */
export function opaPrecoEndpoint(): string {
  const raw = clean(process.env.NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT);
  if (!raw) return DEFAULT_ENDPOINT;
  try {
    const url = new URL(raw);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) return url.origin;
  } catch {
    /* not a URL: the default below */
  }
  return DEFAULT_ENDPOINT;
}

/**
 * The hosts the ad stack needs, by CSP directive: the script and its stylesheet, the
 * request for the ad and its beacons, and the product images, from OpaPreço's origin — and
 * images also from the Shopee's own CDN, which OpaPreço may serve a product photo from
 * instead of its mirror. Empty when ads are off.
 */
export function opaPrecoCsp(): { script: string[]; style: string[]; connect: string[]; image: string[] } {
  if (!opaPrecoEnabled()) return { script: [], style: [], connect: [], image: [] };
  const origin = opaPrecoEndpoint();
  return { script: [origin], style: [origin], connect: [origin], image: [origin, SHOPEE_IMAGES] };
}
