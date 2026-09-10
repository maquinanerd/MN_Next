/**
 * The view model every component consumes — `maquina-nerd-kit/docs/04-dados.md`.
 *
 * Components know these types and nothing else: not the domain model, not Kal El, not
 * where a fixture lives. `lib/content/` builds them on the server; swapping the CMS means
 * swapping that adapter and nothing here.
 *
 * Deviations from the kit's sketch, each for a stated reason:
 *
 *  - `paragrafo` carries typed inline runs (`Trecho[]`), not an `html` string. The
 *    project's charter forbids injecting raw HTML into an article, and the CMS already
 *    stores structured inline content.
 *  - `Editoria` adds `corFundoTexto`: the fill to use when text sits on the editoria
 *    colour. The kit pairs Cinema's `#A248FC` with white (4.31:1) and Séries/Quadrinhos
 *    with white too (3.97:1 and 2.50:1); all three fail the kit's own ≥4.5:1 rule. See
 *    `docs/migration/DECISIONS.md` §7.
 *  - `Chamada.editoria` keeps `slug` and `textoSobreCor` so a card can link its label and
 *    colour a filled label legibly.
 *  - A few blocks the CMS can express and the kit sketch omitted (`citacao`, `lista`,
 *    `tabela`, `galeria`, `video`, `fonte`) are included so no published content is lost.
 */

import type { AdFormato } from '@mn/tokens';

export type { AdFormato };

export type EditoriaSlug = 'cinema' | 'series-e-tv' | 'games' | 'quadrinhos' | 'animes' | 'videos' | 'especiais';

export interface Editoria {
  slug: EditoriaSlug;
  nome: string;
  href: string;
  /** Full colour: strips, rules, underlines, fills. A CSS value, never a literal here. */
  cor: string;
  /** The ≥4.5:1 variant for a label on a light surface. */
  corTexto: string;
  /** Whether text on a fill is white (`light`) or ink (`dark`). */
  textoSobreCor: 'light' | 'dark';
  /** The fill used when text sits on it. Equal to `cor` wherever that already passes. */
  corFundoTexto: string;
  /** Subject filters, "Todos" first. Labels only; the adapter resolves their links. */
  assuntos: string[];
}

/**
 * What a card knows about its editoria. `slug` is a plain string: an article filed under a
 * CMS category outside the seven still renders, in the Notícias colours, under its name.
 */
export type EditoriaRef = Omit<
  Pick<Editoria, 'nome' | 'cor' | 'corTexto' | 'textoSobreCor' | 'corFundoTexto'>,
  never
> & {
  slug: string;
};

export interface RedeSocial {
  tipo: 'site' | 'facebook' | 'instagram' | 'x';
  url: string;
}

export interface Autor {
  slug: string;
  nome: string;
  href: string;
  /** A real portrait only. Without one the rail shows the name alone — no initials disc. */
  avatar?: string;
  redes?: RedeSocial[];
}

export interface Imagem {
  url: string;
  /** Required. Empty only for a decorative image inside a link that already has a name. */
  alt: string;
  credito?: string;
  legenda?: string;
  /** Intrinsic size, when the source knows it. Used to keep a figure's natural ratio. */
  largura?: number;
  altura?: number;
}

export type Formato = 'noticia' | 'reportagem' | 'critica' | 'video' | 'lista' | 'oferta';

/** A card, in any grid. */
export interface Chamada {
  id: string;
  href: string;
  titulo: string;
  resumo?: string;
  /** Absent: a list item without an image. */
  imagem?: Imagem;
  editoria: EditoriaRef;
  /** "Marvel" → label "Cinema · Marvel". */
  assunto?: string;
  /** ISO 8601. */
  publicadoEm: string;
  autores?: Pick<Autor, 'nome' | 'slug' | 'href'>[];
  formato?: Formato;
}

export interface Loja {
  loja: 'Amazon' | 'Shopee' | 'Mercado Livre' | 'Magalu' | 'KaBuM!';
  /** Always rendered with `rel="sponsored nofollow"`. */
  url: string;
  preco?: string;
}

export interface Produto {
  nome: string;
  imagem: Imagem;
  descricao: string;
  /** Formatted. Never invented: absent means no price is shown. */
  precoAtual?: string;
  precoAnterior?: string;
  /** True: render the "preço de demonstração" marker next to the price. */
  demonstracao: boolean;
  ofertas: Loja[];
}

/** An inline run of article text. */
export type Trecho =
  | {
      tipo: 'texto';
      texto: string;
      negrito?: boolean;
      italico?: boolean;
      sublinhado?: boolean;
      riscado?: boolean;
      codigo?: boolean;
      link?: { href: string; externo: boolean };
    }
  | { tipo: 'quebra' };

export type Bloco =
  | { tipo: 'paragrafo'; conteudo: Trecho[] }
  | { tipo: 'subtitulo'; texto: string; id: string; nivel: 2 | 3 | 4 }
  | { tipo: 'imagem'; imagem: Imagem; largura: 'coluna' | 'larga' }
  | { tipo: 'galeria'; imagens: Imagem[] }
  | { tipo: 'citacao'; conteudo: Trecho[]; autoria?: string }
  | { tipo: 'lista'; ordenada: boolean; itens: Trecho[][] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: Trecho[][][] }
  | { tipo: 'video'; provedor: 'youtube' | 'vimeo'; id: string; url: string; titulo: string }
  | { tipo: 'incorporado'; provedor: string; url: string }
  | { tipo: 'fonte'; rotulo: string; url: string }
  | { tipo: 'relacionadas-inline'; itens: Chamada[]; imagem?: Imagem; mais?: { rotulo: string; href: string } }
  | { tipo: 'anuncio'; formato: AdFormato; ordem: number }
  | { tipo: 'produto'; produto: Produto }
  | { tipo: 'leia-tambem'; item: Chamada };

export type Layout = 'padrao' | 'overlay' | 'oferta';

export interface Materia extends Omit<Chamada, 'autores'> {
  layout: Layout;
  /** Present only when it exists and differs from `publicadoEm`. */
  atualizadoEm?: string;
  lead: string;
  blocos: Bloco[];
  relacionadas: Chamada[];
  proxima?: Chamada;
  autores: Autor[];
  /** Absolute canonical URL, for the share buttons. */
  url: string;
  /** Commercial pages only: the "Leia também" links above and below the text. */
  leiaTambem?: Chamada[];
  /** Commercial pages only: whether the affiliate notice applies. */
  afiliados?: boolean;
  /** Paid, affiliate or gifted content: every outbound link is `rel="sponsored nofollow"`. */
  comercial?: boolean;
  /** The disclosure a sponsored, campaign or review-sample article carries at the top. */
  divulgacao?: { rotulo: string; texto: string };
}

/** A sponsored item in the "Conteúdo patrocinado" grid. */
export interface Patrocinado {
  id: string;
  href: string;
  titulo: string;
  imagem: Imagem;
  /** "Parceiro · Patrocinado", or the partner's name. */
  parceiro: string;
}

export interface Paginacao {
  atual: number;
  /** Null when the source cannot count (cursor pagination). */
  total: number | null;
  temProxima: boolean;
}

export interface Filtro {
  rotulo: string;
  href: string;
  ativo: boolean;
}

export interface NavItem {
  rotulo: string;
  href: string;
  /** CSS value of the strip colour. */
  cor: string;
  /** Fill used behind the label when active or hovered. */
  corFundoTexto: string;
  textoSobreCor: 'light' | 'dark';
  /** "Mais" has no editoria: hovering it does not recolour the label. */
  neutro?: boolean;
}
