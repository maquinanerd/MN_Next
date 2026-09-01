/**
 * URLs per article sitemap file.
 *
 * Well under the protocol's 50,000 limit: smaller files are re-fetched more cheaply when
 * one article changes, and both providers must agree on the number or the index will
 * name files the child route cannot serve.
 */
export const SITEMAP_PAGE_SIZE = 5_000;
