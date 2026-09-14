import 'server-only';
import { notFound } from 'next/navigation';

import { parsePageQuery } from './content/repo';
import { clientKey, rateLimit } from './rate-limit';

/**
 * The two ceilings on `/busca`, the one public page whose cost the visitor chooses.
 *
 * Every search is an uncached Kal El query made with the delivery token, and Kal El allows
 * that token 600 requests a minute for the whole site. A scraper walking result pages, or
 * one visitor holding Enter, would spend the quota the home and the articles need.
 */

/** Result pages served. Deeper than this is a crawl, not a reader looking for a story. */
export const SEARCH_MAX_PAGES = 5;

/** `?page=` on search: the site-wide page rule, then the search ceiling. Anything else is a 404. */
export function searchPage(raw: string | string[] | undefined): number {
  const page = parsePageQuery(raw);
  if (page > SEARCH_MAX_PAGES) notFound();
  return page;
}

/**
 * Whether this client may run one more search this minute: per instance, keyed on the
 * client address `clientKey` is allowed to trust (TRUST_PROXY). Over the limit the page
 * explains, instead of asking the CMS.
 */
export function searchAllowed(headers: Headers, max: number): boolean {
  return rateLimit(`busca:${clientKey(headers)}`, max).ok;
}
