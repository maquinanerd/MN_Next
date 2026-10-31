import type { Chamada, Editoria, EditoriaSlug, Layout, Materia, Pagina } from "./types";

/**
 * O que as páginas pedem ao CMS. Hoje só existe a implementação de fixtures; o adaptador
 * do CMS implementa esta mesma interface e nenhum componente muda.
 *
 * Toda resposta carrega `agora` (ISO): o instante em que foi montada. Datas relativas
 * ("6 horas atrás") são calculadas contra ele, e não contra o relógio da renderização,
 * para que a página em cache diga sempre a mesma coisa que a resposta em cache.
 */
export interface Abertura {
  manchete: Chamada;
  destaques: Chamada[];
  lateral: Chamada[];
}

export interface HomeData {
  agora: string;
  abertura: Abertura;
  cinema: { cards: Chamada[]; grandes: Chamada[] };
  games: Chamada[];
  series: { manchete: Chamada; destaques: Chamada[] };
  quadrinhos: Chamada[];
  animes: Chamada[];
  videos: { destaque: Chamada; recomendados: Chamada[]; recentes: Chamada[]; maisVistos?: Chamada[] };
}

export interface EditoriaData {
  agora: string;
  editoria: Editoria;
  assunto?: string;
  /** Só na primeira página sem filtro. */
  abertura?: Abertura;
  feed: Pagina<Chamada>;
}

export interface MateriaRef {
  editoria: EditoriaSlug;
  slug: string;
  layout: Layout;
  publicadoEm: string;
  atualizadoEm?: string;
}

export interface ContentAdapter {
  home(): Promise<HomeData>;
  feed(pagina: number): Promise<Pagina<Chamada> & { agora: string }>;
  editoria(slug: EditoriaSlug, opts: { assunto?: string; pagina: number }): Promise<EditoriaData | null>;
  materia(editoria: string, slug: string): Promise<(Materia & { agora: string }) | null>;
  oferta(slug: string): Promise<(Materia & { agora: string }) | null>;
  ofertas(): Promise<{ itens: Chamada[]; agora: string }>;
  busca(q: string, pagina: number): Promise<Pagina<Chamada> & { agora: string }>;
  todas(): Promise<MateriaRef[]>;
}

export const POR_PAGINA = 8;

export function paginate<T>(itens: T[], pagina: number, porPagina = POR_PAGINA): Pagina<T> {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const start = (pagina - 1) * porPagina;
  return { itens: itens.slice(start, start + porPagina), pagina, totalPaginas };
}
