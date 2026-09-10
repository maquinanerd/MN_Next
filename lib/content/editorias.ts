import { EDITORIA_NAMES, SITE, SOCIAL_LINKS, type EditoriaSlug } from '@mn/content';
import type { Editoria, EditoriaRef, FooterLink, NavItem, SiteFooterProps } from '@mn/ui';

/**
 * Presentation config: the editorias' colours and subjects, the nav, the footer.
 *
 * Colours are CSS values pointing at the tokens (`packages/tokens/src/tokens.css`); no hex
 * lives outside that file. `textoSobreCor` and `corFundoTexto` are where the kit's own
 * table was corrected for contrast — see `docs/migration/DECISIONS.md` §7:
 *
 *  - Séries e TV and Quadrinhos take ink on their fill (white was 3.97:1 and 2.50:1);
 *  - Cinema's fill fails with both white (4.31:1) and ink (4.38:1), so wherever text sits
 *    on it the fill becomes its own text variant `#7A21DB` (white on it: 6.84:1). The
 *    4px strip, the quote rule and every fill without text keep `#A248FC`.
 *
 * Subjects are the prototype's (Máquina Nerd Categorias.dc.html, `subsMap`). They are
 * labels; `lib/content/pages.ts` links each one to the tag of the same name and drops any
 * that has no tag, so a filter never leads to a 404.
 */

const v = (token: string) => `var(--color-${token})`;

export const EDITORIAS: Record<EditoriaSlug, Editoria> = {
  cinema: {
    slug: 'cinema',
    nome: EDITORIA_NAMES.cinema,
    href: '/cinema',
    cor: v('ed-cinema'),
    corTexto: v('ed-cinema-text'),
    textoSobreCor: 'light',
    corFundoTexto: v('ed-cinema-text'),
    assuntos: ['Todos', 'Marvel', 'DC', 'Star Wars', 'Terror', 'Trailers'],
  },
  'series-e-tv': {
    slug: 'series-e-tv',
    nome: EDITORIA_NAMES['series-e-tv'],
    href: '/series-e-tv',
    cor: v('ed-series'),
    corTexto: v('ed-series-text'),
    textoSobreCor: 'dark',
    corFundoTexto: v('ed-series'),
    assuntos: ['Todos', 'Streaming', 'HBO', 'Netflix', 'Cult', 'Trailers'],
  },
  games: {
    slug: 'games',
    nome: EDITORIA_NAMES.games,
    href: '/games',
    cor: v('ed-games'),
    corTexto: v('ed-games-text'),
    textoSobreCor: 'dark',
    corFundoTexto: v('ed-games'),
    assuntos: ['Todos', 'PS5', 'Xbox', 'Nintendo', 'PC', 'Mobile'],
  },
  quadrinhos: {
    slug: 'quadrinhos',
    nome: EDITORIA_NAMES.quadrinhos,
    href: '/quadrinhos',
    cor: v('ed-quadrinhos'),
    corTexto: v('ed-quadrinhos-text'),
    textoSobreCor: 'dark',
    corFundoTexto: v('ed-quadrinhos'),
    assuntos: ['Todos', 'DC Comics', 'Marvel Comics', 'Mangá', 'Independentes'],
  },
  animes: {
    slug: 'animes',
    nome: EDITORIA_NAMES.animes,
    href: '/animes',
    cor: v('ed-animes'),
    corTexto: v('ed-animes-text'),
    textoSobreCor: 'dark',
    corFundoTexto: v('ed-animes'),
    assuntos: ['Todos', 'Lançamentos', 'Shonen', 'Filmes', 'Animação'],
  },
  videos: {
    slug: 'videos',
    nome: EDITORIA_NAMES.videos,
    href: '/videos',
    cor: v('ed-videos'),
    corTexto: v('ed-videos-text'),
    textoSobreCor: 'dark',
    corFundoTexto: v('ed-videos'),
    assuntos: ['Todos', 'Trailers', 'Entrevistas', 'Clipes'],
  },
  especiais: {
    slug: 'especiais',
    nome: EDITORIA_NAMES.especiais,
    href: '/especiais',
    cor: v('ed-especiais'),
    corTexto: v('ed-especiais-text'),
    textoSobreCor: 'light',
    corFundoTexto: v('ed-especiais'),
    assuntos: ['Todos', 'Reportagem', 'Crítica', 'Lista'],
  },
};

/** Notícias is the home, in brand red. Also the fallback for a category outside the seven. */
export const NOTICIAS: EditoriaRef = {
  slug: 'noticias',
  nome: 'Notícias',
  cor: v('ed-noticias'),
  corTexto: v('ed-noticias-text'),
  textoSobreCor: 'light',
  corFundoTexto: v('ed-noticias'),
};

export function refOf(editoria: Editoria): EditoriaRef {
  return {
    slug: editoria.slug,
    nome: editoria.nome,
    cor: editoria.cor,
    corTexto: editoria.corTexto,
    textoSobreCor: editoria.textoSobreCor,
    corFundoTexto: editoria.corFundoTexto,
  };
}

const ORDER: EditoriaSlug[] = ['cinema', 'series-e-tv', 'games', 'quadrinhos', 'animes', 'videos', 'especiais'];

/**
 * The nine nav items (kit docs/02): Notícias, the seven editorias, and "Mais", which
 * leads to the footer's "Explore o Máquina Nerd" — the prototype points it at a design
 * index that does not exist on the site. It is neutral: its hover fill is grey and its
 * label stays ink (white on `#B8B8B8` would be 1.98:1).
 */
export const NAV: NavItem[] = [
  {
    rotulo: NOTICIAS.nome,
    href: '/',
    cor: NOTICIAS.cor,
    corFundoTexto: NOTICIAS.corFundoTexto,
    textoSobreCor: 'light',
  },
  ...ORDER.map((slug) => {
    const e = EDITORIAS[slug];
    return { rotulo: e.nome, href: e.href, cor: e.cor, corFundoTexto: e.corFundoTexto, textoSobreCor: e.textoSobreCor };
  }),
  {
    rotulo: 'Mais',
    href: '#explore',
    cor: v('ed-mais'),
    corFundoTexto: v('ed-mais'),
    textoSobreCor: 'dark',
    neutro: true,
  },
];

export const CINERIE_URL = 'https://cinerie.com/';

/** Footer links, in the prototype's order. Podcast is left out: there is no podcast page. */
export function footerProps(ativo?: string): SiteFooterProps {
  const explorar: FooterLink[] = [
    { rotulo: 'Games', href: '/games' },
    { rotulo: 'Animes', href: '/animes' },
    { rotulo: 'Especiais', href: '/especiais' },
    { rotulo: 'Vídeos', href: '/videos' },
    { rotulo: 'Cinerie', href: CINERIE_URL, externo: true },
    { rotulo: 'Notícias', href: '/' },
    { rotulo: 'Cinema', href: '/cinema' },
    { rotulo: 'Séries e TV', href: '/series-e-tv' },
    { rotulo: 'Quadrinhos', href: '/quadrinhos' },
    { rotulo: 'Reviews', href: '/tag/reviews' },
    { rotulo: 'Newsletter', href: '/newsletter' },
  ].map((l) => ({ ...l, ativo: l.rotulo === ativo }));

  const social = (network: 'facebook' | 'x' | 'instagram') => {
    const link = SOCIAL_LINKS.find((s) => s.network === network);
    return link ? [{ tipo: network, href: link.href, rotulo: link.label }] : [];
  };

  return {
    explorar,
    colunas: [
      [
        { rotulo: 'Termos de uso', href: '/termos-de-uso' },
        { rotulo: 'Sobre o Máquina Nerd', href: '/sobre' },
        { rotulo: 'Política de privacidade', href: '/politica-de-privacidade' },
      ],
      [
        { rotulo: 'Cookies', href: '/cookies' },
        { rotulo: 'Acessibilidade', href: '/acessibilidade' },
        { rotulo: 'Política de afiliados', href: '/politica-de-afiliados' },
      ],
      [
        { rotulo: 'Fale com a redação', href: `mailto:${SITE.contactEmail}` },
        { rotulo: 'Newsletter', href: '/newsletter' },
        { rotulo: 'Anuncie', href: '/anuncie' },
      ],
    ],
    redes: [...social('facebook'), ...social('x'), ...social('instagram')],
    aviso: `© ${new Date().getFullYear()} Máquina Nerd. O Máquina Nerd não se responsabiliza pelo conteúdo de sites externos. Parte da mesma rede do Cinerie.`,
  };
}

export const LOGO = {
  light: '/brand/mn-logo-on-light.png',
  dark: '/brand/mn-logo-on-dark.png',
  width: 267,
  height: 65,
} as const;
