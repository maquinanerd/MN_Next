/**
 * Contratos de conteúdo (docs/04-dados.md). Os componentes só conhecem estes tipos; o
 * adaptador (fixtures hoje, CMS amanhã) é quem os preenche.
 *
 * Diferença deliberada do doc: o parágrafo não carrega `html` cru. Ele chega como uma lista
 * de trechos tipados (texto, negrito, link), para que nenhum HTML vindo do CMS seja injetado
 * na página sem passar pelo mapeamento do adaptador.
 */

export type EditoriaSlug = "cinema" | "series-e-tv" | "games" | "quadrinhos" | "animes" | "videos" | "especiais";

export interface Editoria {
  slug: EditoriaSlug;
  nome: string;
  /** Cor cheia: fundo, filete, sublinhado. */
  cor: string;
  /** Variante para texto sobre fundo claro (≥ 4,5:1). */
  corTexto: string;
  /** Cor do texto sobre a cor cheia, escolhida pelo contraste (≥ 4,5:1). */
  textoSobreCor: "light" | "dark";
  /** Filtros de assunto; o primeiro é sempre "Todos". */
  assuntos: string[];
}

export type EditoriaRef = Pick<Editoria, "slug" | "nome" | "cor" | "corTexto" | "textoSobreCor">;

export type RedeTipo = "site" | "facebook" | "instagram" | "x";

export interface Autor {
  slug: string;
  nome: string;
  /** Só retrato real. Sem retrato, o AuthorRail mostra apenas nome e datas. */
  avatar?: string;
  redes?: { tipo: RedeTipo; url: string }[];
}

export interface Imagem {
  url: string;
  alt: string;
  credito?: string;
  legenda?: string;
  largura?: number;
  altura?: number;
}

export type Formato = "noticia" | "reportagem" | "critica" | "video" | "lista" | "oferta";

export interface Chamada {
  id: string;
  href: string;
  titulo: string;
  resumo?: string;
  imagem?: Imagem;
  editoria: EditoriaRef;
  assunto?: string;
  publicadoEm: string;
  autores?: Pick<Autor, "nome" | "slug">[];
  formato?: Formato;
}

export type Trecho =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; texto: string }
  | { tipo: "link"; texto: string; href: string; patrocinado?: boolean };

export interface Loja {
  loja: "Amazon" | "Shopee" | "Mercado Livre" | "Magalu" | "KaBuM!";
  url: string;
  preco?: string;
}

export interface Produto {
  nome: string;
  imagem: Imagem;
  descricao: string;
  /** String já formatada. Nunca inventar: ausente = só os botões de loja. */
  precoAtual?: string;
  precoAnterior?: string;
  /** true = exibir "preço de demonstração". */
  demonstracao: boolean;
  ofertas: Loja[];
}

export type Bloco =
  | { tipo: "paragrafo"; trechos: Trecho[] }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "imagem"; imagem: Imagem; largura: "coluna" | "larga"; proporcao?: string; pb?: boolean }
  | { tipo: "relacionadas-inline"; itens: Chamada[]; imagem?: Imagem; maisHref?: string; maisRotulo?: string }
  | { tipo: "citacao"; texto: string; autor?: string }
  | { tipo: "divisor" }
  | { tipo: "produto"; produto: Produto }
  | { tipo: "leia-tambem"; item: Chamada }
  | { tipo: "relacionado-flutuante"; item: Chamada };

export type Layout = "padrao" | "overlay" | "oferta";

export interface Materia extends Chamada {
  layout: Layout;
  atualizadoEm?: string;
  lead: Trecho[];
  blocos: Bloco[];
  relacionadas: Chamada[];
  proxima?: Chamada;
  autorDetalhe?: Autor;
  tags?: string[];
  /** Nota curta ao fim do texto ("… está disponível no Disney+"). */
  notaFinal?: string;
  /** Matéria de oferta: "Leia também" do topo e do fim. */
  leiaTambem?: { topo?: Chamada; fim?: Chamada };
  /** Matéria de oferta: grade "Conteúdo patrocinado". */
  patrocinados?: Patrocinado[];
}

export interface Patrocinado {
  id: string;
  titulo: string;
  href: string;
  imagem?: Imagem;
  parceiro: string;
}

/** Recorte de uma lista paginada. */
export interface Pagina<T> {
  itens: T[];
  pagina: number;
  totalPaginas: number;
}
