/**
 * Site policy that is structural rather than CMS content: the editorias and the reserved
 * route segments. Changing any of it changes URLs, so it lives in code, next to the
 * redirects that have to follow it.
 *
 * Presentation (colours, subjects, the nav and footer links) belongs to the front end and
 * lives in `lib/content/editorias.ts`.
 */

export const SITE = {
  name: 'Máquina Nerd',
  tagline: 'Cinema, séries, animes, quadrinhos e games. Tudo sobre cultura pop em um só lugar.',
  locale: 'pt_BR',
  contactEmail: 'contato@maquinanerd.com.br',
  publisherLogo: '/brand/mn-logo-on-light.png',
} as const;

/** The seven editorias and their slugs (kit docs/03). The home is "Notícias". */
export const EDITORIA_SLUGS = [
  'cinema',
  'series-e-tv',
  'games',
  'quadrinhos',
  'animes',
  'videos',
  'especiais',
] as const;

export type EditoriaSlug = (typeof EDITORIA_SLUGS)[number];

export const EDITORIA_NAMES: Record<EditoriaSlug, string> = {
  cinema: 'Cinema',
  'series-e-tv': 'Séries e TV',
  games: 'Games',
  quadrinhos: 'Quadrinhos',
  animes: 'Animes',
  videos: 'Vídeos',
  especiais: 'Especiais',
};

export function isEditoriaSlug(slug: string): slug is EditoriaSlug {
  return (EDITORIA_SLUGS as readonly string[]).includes(slug);
}

/**
 * Every first path segment that is an editoria — the routing map. The legacy-permalink
 * resolver treats `/{anything-else}` as a WordPress URL, and the importer files a post
 * under one of these or refuses to file it.
 */
export const DESK_SLUGS: readonly string[] = EDITORIA_SLUGS;

/** Offer pages live under their own segment, whatever their editoria (kit docs/03). */
export const OFFER_SEGMENT = 'ofertas';

/**
 * Desk slugs the previous build and the WordPress archive used, and where they went.
 * Answered by the edge redirect table; kept here so the importer and the redirects share
 * one list.
 */
export const RENAMED_DESKS: Record<string, string> = {
  filmes: '/cinema',
  series: '/series-e-tv',
  noticias: '/',
  reviews: '/tag/reviews',
};

/**
 * Reserved first path segments. `/[categoria]` is a catch-all, so anything that is also a
 * real route must never be read as an editoria — `/busca` is not an editoria named "busca".
 */
export const RESERVED_SEGMENTS = new Set([
  OFFER_SEGMENT,
  'autor',
  'tag',
  'busca',
  'newsletter',
  'sobre',
  'anuncie',
  'politica-de-afiliados',
  'politica-de-privacidade',
  'termos-de-uso',
  'cookies',
  'acessibilidade',
  'publicidade',
  'page',
  'preview',
  'media',
  'api',
  'feed.xml',
  'news-sitemap.xml',
  'sitemap.xml',
  'sitemap',
  'robots.txt',
]);

export interface SocialLink {
  network: 'facebook' | 'instagram' | 'x' | 'youtube';
  href: string;
  label: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { network: 'facebook', href: 'https://www.facebook.com/maquinanerd', label: 'Máquina Nerd no Facebook' },
  { network: 'x', href: 'https://x.com/maquinanerd', label: 'Máquina Nerd no X' },
  { network: 'instagram', href: 'https://www.instagram.com/maquinanerd', label: 'Máquina Nerd no Instagram' },
  { network: 'youtube', href: 'https://www.youtube.com/@maquinanerd', label: 'Máquina Nerd no YouTube' },
];
