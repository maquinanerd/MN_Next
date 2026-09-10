import 'server-only';

import {
  EDITORIA_SLUGS,
  FIXTURE_NOW,
  isEditoriaSlug,
  slugify,
  type Article,
  type ArticleSummary,
  type Category,
  type Tag,
} from '@mn/content';
import { isBrandUnsafe } from '@mn/content/kalel/mapper';
import type { Chamada, Editoria, Filtro, Materia, NestaEditoria, Paginacao, Patrocinado } from '@mn/ui';

import { seoContext } from '../seo-context';
import { CINERIE_URL, EDITORIAS, NOTICIAS } from './editorias';
import { PATROCINADOS_DEMO } from './fixtures/patrocinados';
import { assuntoOf, toChamadas, toMateria } from './map';
import { optional, repo } from './repo';

/**
 * Page loaders: one per template, each returning the view model its components consume.
 *
 * The composition rules — how many items an opening takes, where a section starts, which
 * stories are "Mais como este" — live here, identical for every content source.
 */

/** "Now" for relative times. Fixed in fixture mode so a screenshot never drifts. */
export function agora(): Date {
  return repo().source === 'fixture' ? FIXTURE_NOW : new Date();
}

/** The opening of the home and of an editoria: lead, three overlays, four side items. */
export const OPENING = 8;
/** "Mais do Máquina Nerd": nine rows, with a 728×90 after every third (kit docs/03). */
export const FEED_PER_PAGE = 9;
/** "Todas as notícias de …" */
export const EDITORIA_PER_PAGE = 10;

export interface Abertura {
  manchete: Chamada | null;
  destaques: Chamada[];
  lateral: Chamada[];
}

function abertura(items: Chamada[]): Abertura {
  return { manchete: items[0] ?? null, destaques: items.slice(1, 4), lateral: items.slice(4, 8) };
}

function paginacao(page: { page: number; totalPages: number | null; hasNext: boolean }): Paginacao {
  return { atual: page.page, total: page.totalPages, temProxima: page.hasNext };
}

/** Takes up to `n` items not already used on the page, and marks them used. */
function take(items: Chamada[], used: Set<string>, n: number): Chamada[] {
  const out: Chamada[] = [];
  for (const item of items) {
    if (out.length >= n) break;
    if (used.has(item.id)) continue;
    used.add(item.id);
    out.push(item);
  }
  return out;
}

async function section(slug: string, perPage: number): Promise<Chamada[]> {
  const page = await optional(repo().listCategory(slug, 1, { perPage }), `home-${slug}`);
  return page ? toChamadas(page.items) : [];
}

// ------------------------------------------------------------------- home

export interface HomeView {
  abertura: Abertura;
  cinema: Chamada[];
  games: Chamada[];
  series: { manchete: Chamada | null; destaques: Chamada[] };
  quadrinhos: Chamada[];
  animes: Chamada[];
  videos: { destaque: Chamada | null; clipes: Chamada[] };
  feed: Chamada[];
  paginacao: Paginacao;
  /** For the JSON-LD collection. */
  itens: ArticleSummary[];
}

/**
 * The home, in the prototype's order (Máquina Nerd Template.dc.html): the opening, then
 * Cinema, Games, a 970×250, Séries e TV with "Últimas de Quadrinhos", Animes, the video
 * band and "Mais do Máquina Nerd". A story is never shown twice above the feed.
 */
export async function homeView(): Promise<HomeView> {
  const [latest, cinema, series, games, quadrinhos, animes, videos, feed] = await Promise.all([
    repo().listLatest(1, { perPage: OPENING }),
    section('cinema', 14),
    section('series-e-tv', 12),
    section('games', 10),
    section('quadrinhos', 10),
    section('animes', 10),
    section('videos', 10),
    repo().listLatest(1, { skip: OPENING, perPage: FEED_PER_PAGE }),
  ]);

  const used = new Set<string>();
  const opening = take(toChamadas(latest.items), used, OPENING);
  const seriesItems = take(series, used, 4);

  return {
    abertura: abertura(opening),
    cinema: take(cinema, used, 6),
    games: take(games, used, 4),
    series: { manchete: seriesItems[0] ?? null, destaques: seriesItems.slice(1, 4) },
    quadrinhos: take(quadrinhos, used, 4),
    animes: take(animes, used, 3),
    videos: (() => {
      const v = take(videos, used, 5);
      return { destaque: v[0] ?? null, clipes: v.slice(1, 5) };
    })(),
    feed: toChamadas(feed.items),
    paginacao: paginacao(feed),
    itens: latest.items,
  };
}

/** `/page/{n}`: the home feed, continued. */
export async function latestView(
  page: number,
): Promise<{ feed: Chamada[]; paginacao: Paginacao; itens: ArticleSummary[] }> {
  const result = await repo().listLatest(page, { skip: OPENING, perPage: FEED_PER_PAGE });
  return { feed: toChamadas(result.items), paginacao: paginacao(result), itens: result.items };
}

// ---------------------------------------------------------------- editoria

/** The editoria for a slug; a CMS category outside the seven renders in Notícias colours. */
export function editoriaFor(category: Category): Editoria {
  if (isEditoriaSlug(category.slug)) return EDITORIAS[category.slug];
  return {
    slug: 'especiais',
    nome: category.name,
    href: `/${category.slug}`,
    cor: NOTICIAS.cor,
    corTexto: NOTICIAS.corTexto,
    textoSobreCor: NOTICIAS.textoSobreCor,
    corFundoTexto: NOTICIAS.corFundoTexto,
    assuntos: ['Todos'],
  };
}

/** Subject labels to tag pages. A label without a tag is dropped, so a filter never 404s. */
function filtrosFor(editoria: Editoria, href: string, tags: Tag[] | null, ativo?: string): Filtro[] {
  const byName = new Map((tags ?? []).map((t) => [t.name.toLowerCase(), t]));
  const bySlug = new Map((tags ?? []).map((t) => [t.slug, t]));
  const subjects = editoria.assuntos
    .slice(1)
    .map((label) => {
      const tag = byName.get(label.toLowerCase()) ?? bySlug.get(slugify(label));
      return tag ? { rotulo: label, href: `/tag/${tag.slug}`, ativo: label === ativo } : null;
    })
    .filter((f): f is Filtro => f !== null);
  return [{ rotulo: editoria.assuntos[0] ?? 'Todos', href, ativo: ativo === undefined }, ...subjects];
}

export interface EditoriaView {
  editoria: Editoria;
  category: Category;
  filtros: Filtro[];
  abertura: Abertura | null;
  lista: Chamada[];
  paginacao: Paginacao;
  itens: ArticleSummary[];
}

/**
 * An editoria (Máquina Nerd Categorias.dc.html): the header with its subject filters, the
 * opening on page 1, then "Todas as notícias de …" — which starts *after* the opening, so
 * page 2 never repeats what page 1 led with.
 */
export async function editoriaView(slug: string, page: number): Promise<EditoriaView> {
  const [top, list, tags] = await Promise.all([
    page === 1 ? repo().listCategory(slug, 1, { perPage: OPENING }) : Promise.resolve(null),
    repo().listCategory(slug, page, { skip: OPENING, perPage: EDITORIA_PER_PAGE }),
    optional(repo().listTags(), 'editoria-tags'),
  ]);
  const editoria = editoriaFor(list.category);
  return {
    editoria,
    category: list.category,
    filtros: filtrosFor(editoria, `/${list.category.slug}`, tags),
    abertura: top ? abertura(toChamadas(top.items)) : null,
    lista: toChamadas(list.items),
    paginacao: paginacao(list),
    itens: [...(top?.items ?? []), ...list.items],
  };
}

// ---------------------------------------------------------------- materia

const TODOS: Record<string, string> = {
  cinema: 'Todo o Cinema',
  'series-e-tv': 'Todas as Séries e TV',
  games: 'Todos os Games',
  quadrinhos: 'Todos os Quadrinhos',
  animes: 'Todos os Animes',
  videos: 'Todos os Vídeos',
  especiais: 'Todos os Especiais',
};

export interface MateriaView {
  materia: Materia;
  article: Article;
  editoria: Editoria | null;
  nav: NestaEditoria;
  patrocinados: Patrocinado[];
  flutuante?: Chamada;
}

/**
 * An article page. The secondary reads — related stories, the next story, the other
 * offers — are optional: any failure there leaves the article itself at 200, with the
 * modules that could not be filled simply absent.
 */
export async function materiaView(article: Article): Promise<MateriaView | null> {
  const categorySlug = article.category?.slug ?? null;
  const [categoryItems, latest, offers, tags] = await Promise.all([
    categorySlug ? optional(repo().listCategory(categorySlug, 1, { perPage: 14 }), 'related') : Promise.resolve(null),
    optional(repo().listLatest(1, { perPage: 10 }), 'next-story'),
    article.layout === 'offer' ? optional(repo().listOffers(1, { perPage: 6 }), 'offers') : Promise.resolve(null),
    optional(repo().listTags(), 'article-tags'),
  ]);

  const others = toChamadas((categoryItems?.items ?? []).filter((a) => a.id !== article.id));
  const assunto = assuntoOf(article);
  const sameSubject = assunto ? others.filter((c) => c.assunto === assunto) : [];
  const maisComoEste = [...sameSubject, ...others.filter((c) => !sameSubject.includes(c))].slice(0, 3);
  const relacionadas = others.filter((c) => !maisComoEste.includes(c)).slice(0, 6);
  const shown = new Set([article.id, ...maisComoEste.map((c) => c.id), ...relacionadas.map((c) => c.id)]);
  const proxima = toChamadas(latest?.items ?? []).find((c) => !shown.has(c.id));

  const otherOffers = toChamadas((offers?.items ?? []).filter((a) => a.id !== article.id));
  const assuntoTag = assunto ? (tags ?? []).find((t) => t.name === assunto) : undefined;
  const editoria = article.category ? editoriaFor(article.category) : null;

  const materia = toMateria(article, {
    siteUrl: seoContext().siteUrl,
    adsPermitidos: !isBrandUnsafe(article.tags),
    maisComoEste,
    ...(assuntoTag
      ? { maisLink: { rotulo: `Tudo sobre ${assunto}`, href: `/tag/${assuntoTag.slug}` } }
      : editoria
        ? { maisLink: { rotulo: TODOS[editoria.slug] ?? `Tudo em ${editoria.nome}`, href: editoria.href } }
        : {}),
    relacionadas,
    ...(proxima ? { proxima } : {}),
    leiaTambem: otherOffers.slice(0, 2),
  });
  if (!materia) return null;

  const nav: NestaEditoria = {
    editoria: {
      nome: editoria?.nome ?? NOTICIAS.nome,
      href: editoria?.href ?? '/',
      corTexto: editoria?.corTexto ?? NOTICIAS.corTexto,
    },
    assuntos: editoria ? filtrosFor(editoria, editoria.href, tags, assunto) : [],
    outras: [
      ...EDITORIA_SLUGS.filter((s) => s !== editoria?.slug).map((s) => ({
        rotulo: EDITORIAS[s].nome,
        href: EDITORIAS[s].href,
      })),
      { rotulo: 'Reviews', href: '/tag/reviews' },
      { rotulo: 'Cinerie', href: CINERIE_URL, externo: true },
    ],
    todos: { rotulo: (editoria && TODOS[editoria.slug]) ?? 'Todas as notícias', href: editoria?.href ?? '/' },
  };

  return {
    materia,
    article,
    editoria,
    nav,
    // No partner feed exists yet; the demonstration items render in fixture mode only.
    patrocinados: repo().source === 'fixture' && article.layout === 'offer' ? PATROCINADOS_DEMO : [],
    ...(article.layout === 'offer' && (otherOffers[2] ?? others[0]) ? { flutuante: otherOffers[2] ?? others[0] } : {}),
  };
}

// ---------------------------------------------------------------- listings

export interface ListView {
  lista: Chamada[];
  paginacao: Paginacao;
  itens: ArticleSummary[];
}

export function listView(page: {
  items: ArticleSummary[];
  page: number;
  totalPages: number | null;
  hasNext: boolean;
}): ListView {
  return { lista: toChamadas(page.items), paginacao: paginacao(page), itens: page.items };
}
