/**
 * Cache tag vocabulary and the revalidation matrix.
 *
 * Tags are built here and nowhere else. A webhook payload never supplies a tag string:
 * it supplies an article id and a slug, and this module turns those into the tags the
 * route handlers actually registered. Accepting a caller-supplied tag would let anyone
 * holding the webhook secret purge arbitrary cache keys.
 */

export const TAG = {
  home: 'home',
  sitemap: 'sitemap',
  news: 'news',
  redirects: 'redirects',
  taxonomy: 'taxonomy',
  media: 'media',
  cinerie: 'cinerie:titles',
  search: 'search',
} as const;

export const articleTag = (id: string) => `article:${id}`;
export const articleSlugTag = (slug: string) => `article-slug:${slug}`;
export const categoryTag = (slug: string) => `category:${slug}`;
export const tagTag = (slug: string) => `tag:${slug}`;
export const authorTag = (slug: string) => `author:${slug}`;
export const specialTag = (slug: string) => `special:${slug}`;
export const liveTag = (slug: string) => `live:${slug}`;

/** Revalidate windows, in seconds (docs/08-performance.md). */
export const REVALIDATE = {
  home: 60,
  article: 300,
  category: 120,
  author: 300,
  tag: 300,
  special: 300,
  live: 15,
  taxonomy: 3600,
  cinerie: 3600,
  sitemap: 3600,
  news: 300,
  redirects: 300,
} as const;

export type RevalidateKey = keyof typeof REVALIDATE;

/** Every tag name this application is willing to revalidate, for webhook validation. */
export function isKnownTagShape(tag: string): boolean {
  if ((Object.values(TAG) as string[]).includes(tag)) return true;
  return /^(article|article-slug|category|tag|author|special|live):[a-z0-9][a-z0-9._-]{0,200}$/i.test(tag);
}
