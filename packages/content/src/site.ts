/**
 * Site chrome that is editorial policy, not CMS content: the navigation, the footer
 * columns and the network links the prototypes render on every page.
 *
 * Kept here rather than in `@mn/ui` so a component never hard-codes a route, and here
 * rather than in the CMS because these are structural decisions with a redirect
 * consequence - changing them changes URLs.
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavItem[];
}

export interface SocialLink {
  network: 'facebook' | 'instagram' | 'x' | 'youtube';
  href: string;
  label: string;
}

export interface NetworkLink {
  brand: 'mn' | 'cinerie';
  label: string;
  description: string;
  href: string;
}

export const SITE = {
  name: 'Máquina Nerd',
  tagline: 'Cinema, séries, animes, quadrinhos e games. Tudo sobre cultura pop em um só lugar.',
  locale: 'pt_BR',
  contactEmail: 'contato@maquinanerd.com.br',
  publisherLogo: '/brand/mn-logo-on-light.png',
} as const;

/** Editorial desks. Sub-desks are tags, never route segments (docs/04). */
export const CATEGORIES = {
  filmes: { name: 'Filmes', subs: ['Marvel', 'DC', 'Star Wars', 'Terror', 'Animação', 'Bilheteria', 'Trailers'] },
  series: {
    name: 'Séries de TV',
    subs: ['HBO Max', 'Netflix', 'Disney+', 'Prime Video', 'Renovações', 'Audiência', 'Trailers'],
  },
  quadrinhos: {
    name: 'Quadrinhos',
    subs: ['Marvel Comics', 'DC Comics', 'Mangá', 'Independentes', 'Encadernados', 'Adaptações'],
  },
  games: { name: 'Games', subs: [] as string[] },
  animes: { name: 'Animes', subs: [] as string[] },
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

export const CATEGORY_SLUGS = Object.keys(CATEGORIES) as CategorySlug[];

/**
 * Reserved first path segments.
 *
 * `/[categoria]` is a catch-all, so anything that is also a real route must never be
 * treated as a desk; otherwise `/busca` would resolve as a category named "busca".
 */
export const RESERVED_SEGMENTS = new Set([
  'especiais',
  'ao-vivo',
  // 'reviews' is deliberately absent: it is a real desk served by [categoria]/[slug].
  // The static /reviews index shadows the listing, but /reviews/{slug} must resolve as
  // an article — routing it through a dedicated redirect made it point at itself.
  'ofertas',
  'autor',
  'tag',
  'busca',
  'newsletter',
  'sobre',
  'politica-de-privacidade',
  'publicidade',
  'preview',
  'media',
  'api',
  'feed.xml',
  'news-sitemap.xml',
  'sitemap.xml',
  'robots.txt',
]);

export const NAV_ITEMS: NavItem[] = [
  { label: 'Notícias', href: '/noticias' },
  { label: 'Filmes', href: '/filmes' },
  { label: 'Séries de TV', href: '/series' },
  { label: 'Quadrinhos', href: '/quadrinhos' },
  { label: 'Games', href: '/games' },
  { label: 'Reviews', href: '/reviews' },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Editorias',
    links: [
      { label: 'Filmes', href: '/filmes' },
      { label: 'Séries', href: '/series' },
      { label: 'Quadrinhos', href: '/quadrinhos' },
      { label: 'Games', href: '/games' },
      { label: 'Animes', href: '/animes' },
    ],
  },
  {
    title: 'Institucional',
    links: [
      { label: 'Quem somos', href: '/sobre' },
      { label: 'Política de privacidade', href: '/politica-de-privacidade' },
      { label: 'Política de afiliados', href: '/publicidade#afiliados' },
      { label: 'Publicidade e parcerias', href: '/publicidade' },
    ],
  },
  {
    title: 'Contato',
    links: [
      { label: SITE.contactEmail, href: `mailto:${SITE.contactEmail}` },
      { label: 'Newsletter', href: '/newsletter' },
      { label: 'Correções', href: '/sobre#correcoes' },
    ],
  },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { network: 'facebook', href: 'https://www.facebook.com/maquinanerd', label: 'Máquina Nerd no Facebook' },
  { network: 'instagram', href: 'https://www.instagram.com/maquinanerd', label: 'Máquina Nerd no Instagram' },
  { network: 'x', href: 'https://x.com/maquinanerd', label: 'Máquina Nerd no X' },
  { network: 'youtube', href: 'https://www.youtube.com/@maquinanerd', label: 'Máquina Nerd no YouTube' },
];

export const NETWORK_LINKS: NetworkLink[] = [
  {
    brand: 'mn',
    label: 'Máquina Nerd',
    description: 'Cultura pop',
    href: 'https://www.maquinanerd.com.br/',
  },
  {
    brand: 'cinerie',
    label: 'Cinerie',
    description: 'Cinema e séries',
    href: 'https://cinerie.com/',
  },
];
