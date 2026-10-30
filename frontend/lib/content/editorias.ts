import type { Editoria, EditoriaRef, EditoriaSlug } from "./types";

/**
 * Editorias e cores (docs/01-tokens.md, protótipo Categorias).
 *
 * `textoSobreCor` não segue a coluna "Texto sobre a cheia" do doc em três casos: branco
 * sobre o roxo de Cinema dá 4,3:1, sobre o azul de Séries e TV 4,0:1 e sobre o laranja de
 * Quadrinhos 2,5:1 — todos abaixo do mínimo de 4,5:1, que é regra inviolável. Nesses três o
 * texto sobre a cor cheia é preto (4,9:1, 5,3:1 e 8,4:1).
 */
export const EDITORIAS: Record<EditoriaSlug, Editoria> = {
  cinema: {
    slug: "cinema",
    nome: "Cinema",
    cor: "#A248FC",
    corTexto: "#7A21DB",
    textoSobreCor: "dark",
    assuntos: ["Todos", "Marvel", "DC", "Star Wars", "Terror", "Trailers"],
  },
  "series-e-tv": {
    slug: "series-e-tv",
    nome: "Séries e TV",
    cor: "#5075FC",
    corTexto: "#2B4FD6",
    textoSobreCor: "dark",
    assuntos: ["Todos", "Streaming", "HBO", "Netflix", "Cult", "Trailers"],
  },
  games: {
    slug: "games",
    nome: "Games",
    cor: "#F2CF51",
    corTexto: "#7A5E00",
    textoSobreCor: "dark",
    assuntos: ["Todos", "PS5", "Xbox", "Nintendo", "PC", "Mobile"],
  },
  quadrinhos: {
    slug: "quadrinhos",
    nome: "Quadrinhos",
    cor: "#EA8D49",
    corTexto: "#9A4E10",
    textoSobreCor: "dark",
    assuntos: ["Todos", "DC Comics", "Marvel Comics", "Mangá", "Independentes"],
  },
  animes: {
    slug: "animes",
    nome: "Animes",
    cor: "#64D56F",
    corTexto: "#20873C",
    textoSobreCor: "dark",
    assuntos: ["Todos", "Lançamentos", "Shonen", "Filmes", "Animação"],
  },
  videos: {
    slug: "videos",
    nome: "Vídeos",
    cor: "#68B3F7",
    corTexto: "#0A6F97",
    textoSobreCor: "dark",
    assuntos: ["Todos", "Trailers", "Entrevistas", "Clipes"],
  },
  especiais: {
    slug: "especiais",
    nome: "Especiais",
    cor: "#1E1E1E",
    corTexto: "#1E1E1E",
    textoSobreCor: "light",
    assuntos: ["Todos", "Reportagem", "Crítica", "Lista"],
  },
};

export const EDITORIA_SLUGS = Object.keys(EDITORIAS) as EditoriaSlug[];

/** "Notícias" usa o vermelho da marca e leva à home. */
export const NOTICIAS: Omit<EditoriaRef, "slug"> & { href: string } = {
  nome: "Notícias",
  cor: "#E30613",
  corTexto: "#B00710",
  textoSobreCor: "light",
  href: "/",
};

export function isEditoriaSlug(value: string): value is EditoriaSlug {
  return Object.hasOwn(EDITORIAS, value);
}

export function getEditoria(slug: string): Editoria | undefined {
  return isEditoriaSlug(slug) ? EDITORIAS[slug] : undefined;
}

export function editoriaRef(slug: EditoriaSlug): EditoriaRef {
  const { nome, cor, corTexto, textoSobreCor } = EDITORIAS[slug];
  return { slug, nome, cor, corTexto, textoSobreCor };
}

/** "Mangá" → "manga", "DC Comics" → "dc-comics". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function assuntoBySlug(editoria: Editoria, slug: string): string | undefined {
  return editoria.assuntos.slice(1).find((a) => slugify(a) === slug);
}

export type NavKey = EditoriaSlug | "noticias" | "mais";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  cor: string;
  textoSobreCor: "light" | "dark";
}

export const NAV: NavItem[] = [
  { key: "noticias", label: "Notícias", href: "/", cor: NOTICIAS.cor, textoSobreCor: "light" },
  ...EDITORIA_SLUGS.map((slug) => ({
    key: slug,
    label: EDITORIAS[slug].nome,
    href: `/${slug}`,
    cor: EDITORIAS[slug].cor,
    textoSobreCor: EDITORIAS[slug].textoSobreCor,
  })),
  { key: "mais", label: "Mais", href: "/mais", cor: "#B8B8B8", textoSobreCor: "dark" },
];

export const ON_COLOR = { light: "#FFFFFF", dark: "#111111" } as const;
