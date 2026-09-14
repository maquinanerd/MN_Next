import {
  articlePath,
  isEditoriaSlug,
  isReservedTag,
  type Article,
  type ArticleSummary,
  type Author,
  type Category,
  type CommercialKind,
  type ContentBlock,
  type Image,
  type Product,
  type RichText,
} from '@mn/content';
import type { Autor, Bloco, Chamada, EditoriaRef, Formato, Imagem, Layout, Materia, Produto, Trecho } from '@mn/ui';

import { EDITORIAS, NOTICIAS, refOf } from './editorias';

/**
 * Domain → view model. Pure functions, no I/O: everything here is unit-tested, and the
 * same code serves the fixture and the Kal El providers, so a component can never tell
 * which one it is looking at.
 */

export function editoriaRef(category: Category | null): EditoriaRef {
  if (category && isEditoriaSlug(category.slug)) return refOf(EDITORIAS[category.slug]);
  // A category outside the seven still renders, under its own name, in Notícias red.
  return { ...NOTICIAS, slug: category?.slug ?? NOTICIAS.slug, nome: category?.name ?? NOTICIAS.nome };
}

export function toImagem(image: Image): Imagem {
  return {
    url: image.url,
    alt: image.alt,
    largura: image.width,
    altura: image.height,
    ...(image.credit ? { credito: image.credit } : {}),
    ...(image.caption ? { legenda: image.caption } : {}),
  };
}

export function toAutor(author: Author): Autor {
  const redes = (['site', 'facebook', 'instagram', 'x'] as const)
    .map((tipo) => ({ tipo, url: author.social?.[tipo] }))
    .filter((r): r is { tipo: 'site' | 'facebook' | 'instagram' | 'x'; url: string } => Boolean(r.url));
  return {
    slug: author.slug,
    nome: author.name,
    href: `/autor/${author.slug}`,
    ...(author.avatar ? { avatar: author.avatar.url } : {}),
    ...(redes.length > 0 ? { redes } : {}),
  };
}

/**
 * The subject a card is labelled with ("Marvel"): a tag the editoria lists as a subject if
 * the article has one, else its first non-reserved tag. Reserved tags are switches, never
 * topics.
 */
export function assuntoOf(summary: Pick<ArticleSummary, 'tags' | 'category'>): string | undefined {
  const topics = summary.tags.filter((t) => !isReservedTag(t.slug));
  const editoria = summary.category && isEditoriaSlug(summary.category.slug) ? EDITORIAS[summary.category.slug] : null;
  const preferred = editoria ? topics.find((t) => editoria.assuntos.includes(t.name)) : undefined;
  return (preferred ?? topics[0])?.name;
}

function formatoOf(summary: ArticleSummary): Formato {
  if (summary.layout === 'offer') return 'oferta';
  if (summary.template === 'video') return 'video';
  if (summary.template === 'list') return 'lista';
  if (summary.template === 'longform') return 'reportagem';
  return 'noticia';
}

/** A card. Null when the article has no public URL — a card that 404s is worse than none. */
export function toChamada(summary: ArticleSummary): Chamada | null {
  const href = articlePath(summary);
  if (!href || !summary.publishedAt) return null;
  const assunto = assuntoOf(summary);
  return {
    id: summary.id,
    href,
    titulo: summary.title,
    ...(summary.excerpt ? { resumo: summary.excerpt } : {}),
    ...(summary.cover ? { imagem: toImagem(summary.cover) } : {}),
    editoria: editoriaRef(summary.category),
    ...(assunto ? { assunto } : {}),
    publicadoEm: summary.publishedAt,
    autores: summary.authors.map((a) => ({ nome: a.name, slug: a.slug, href: `/autor/${a.slug}` })),
    formato: formatoOf(summary),
  };
}

export function toChamadas(items: ArticleSummary[]): Chamada[] {
  return items.map(toChamada).filter((c): c is Chamada => c !== null);
}

function trechos(rich: RichText): Trecho[] {
  return rich.map((node): Trecho => {
    if (node.type === 'break') return { tipo: 'quebra' };
    const has = (m: string) => node.marks.some((x) => x.type === m);
    const link = node.marks.find((x) => x.type === 'link' && x.href);
    return {
      tipo: 'texto',
      texto: node.text,
      ...(has('bold') ? { negrito: true } : {}),
      ...(has('italic') ? { italico: true } : {}),
      ...(has('underline') ? { sublinhado: true } : {}),
      ...(has('strike') ? { riscado: true } : {}),
      ...(has('code') ? { codigo: true } : {}),
      ...(link?.href ? { link: { href: link.href, externo: !link.href.startsWith('/') } } : {}),
    };
  });
}

/** The last path segment for `/embed/ID`, `/shorts/ID` and `youtu.be/ID`; `?v=` otherwise. */
export function videoId(provider: 'youtube' | 'vimeo', url: string, embedId?: string): string | null {
  if (embedId) return embedId;
  try {
    const parsed = new URL(url);
    if (provider === 'youtube')
      return parsed.searchParams.get('v') ?? parsed.pathname.split('/').filter(Boolean).pop() ?? null;
    return parsed.pathname.split('/').filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

const PROVIDER_NAME: Record<string, string> = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', spotify: 'Spotify' };

export function toProduto(product: Product): Produto {
  return {
    nome: product.name,
    imagem: toImagem(product.image),
    descricao: product.description,
    ...(product.price ? { precoAtual: product.price } : {}),
    ...(product.listPrice ? { precoAnterior: product.listPrice } : {}),
    demonstracao: product.demo,
    ofertas: product.offers.map((o) => ({ loja: o.retailer, url: o.url, ...(o.price ? { preco: o.price } : {}) })),
  };
}

export function toBlocos(body: ContentBlock[], titulo: string): Bloco[] {
  const out: Bloco[] = [];
  for (const block of body) {
    switch (block.type) {
      case 'paragraph':
        out.push({ tipo: 'paragrafo', conteudo: trechos(block.content) });
        break;
      case 'heading':
        out.push({ tipo: 'subtitulo', texto: block.text, id: block.id, nivel: block.level });
        break;
      case 'image':
        out.push({
          tipo: 'imagem',
          imagem: toImagem(block.image),
          largura: block.size === 'inline' ? 'coluna' : 'larga',
        });
        break;
      case 'gallery':
        out.push({ tipo: 'galeria', imagens: block.images.map(toImagem) });
        break;
      case 'quote':
        out.push({
          tipo: 'citacao',
          conteudo: trechos(block.content),
          ...(block.attribution ? { autoria: block.attribution } : {}),
        });
        break;
      case 'list':
        out.push({ tipo: 'lista', ordenada: block.style === 'number', itens: block.items.map(trechos) });
        break;
      case 'table':
        out.push({ tipo: 'tabela', cabecalho: block.headers, linhas: block.rows.map((row) => row.map(trechos)) });
        break;
      case 'embed': {
        if (block.provider === 'youtube' || block.provider === 'vimeo') {
          const id = videoId(block.provider, block.url, block.embedId);
          if (id) {
            out.push({ tipo: 'video', provedor: block.provider, id, url: block.url, titulo: `Vídeo: ${titulo}` });
            break;
          }
        }
        out.push({ tipo: 'incorporado', provedor: PROVIDER_NAME[block.provider] ?? block.provider, url: block.url });
        break;
      }
      case 'sourceLink':
        out.push({ tipo: 'fonte', rotulo: block.label, url: block.url });
        break;
      case 'product':
        out.push({ tipo: 'produto', produto: toProduto(block.product) });
        break;
    }
  }
  return out;
}

/**
 * "Mais como este" goes after the first paragraph, as in every article prototype — and
 * only when there is text on both sides of it and at least two stories to offer.
 */
export function withRelatedInline(blocos: Bloco[], itens: Chamada[], mais?: { rotulo: string; href: string }): Bloco[] {
  if (itens.length < 2) return blocos;
  const first = blocos.findIndex((b) => b.tipo === 'paragrafo');
  const paragraphs = blocos.filter((b) => b.tipo === 'paragrafo').length;
  if (first === -1 || paragraphs < 2) return blocos;
  const imagem = itens.find((c) => c.imagem)?.imagem;
  const box: Bloco = {
    tipo: 'relacionadas-inline',
    itens: itens.slice(0, 3),
    ...(imagem ? { imagem } : {}),
    ...(mais ? { mais } : {}),
  };
  return [...blocos.slice(0, first + 1), box, ...blocos.slice(first + 1)];
}

/**
 * Two 728×90 slots per article (kit docs/05), placed by rule rather than by hand:
 *
 *  - only *between two paragraphs* — never after an image, a heading or a quote;
 *  - not before the second paragraph, and never within three blocks of each other;
 *  - aimed at 40% and 75% of the text, so a long piece carries them where reading is.
 *
 * A text too short to hold one under those rules simply has fewer. `permitido` is the
 * brand-safety switch, decided on the server from the article's reserved tags.
 */
export function withAds(blocos: Bloco[], permitido: boolean, max = 2): Bloco[] {
  if (!permitido) return blocos;
  const candidates: number[] = [];
  // Paragraphs strictly before position i: a slot needs two of them above it.
  let before = 0;
  for (let i = 0; i < blocos.length; i += 1) {
    if (before >= 2 && blocos[i - 1]?.tipo === 'paragrafo' && blocos[i]?.tipo === 'paragrafo') {
      candidates.push(i);
    }
    if (blocos[i]?.tipo === 'paragrafo') before += 1;
  }
  const picks: number[] = [];
  for (const fraction of [0.4, 0.75]) {
    if (picks.length >= max) break;
    const target = Math.floor(blocos.length * fraction);
    const best = candidates
      .filter((c) => picks.every((p) => Math.abs(p - c) >= 3))
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    if (best !== undefined) picks.push(best);
  }
  const ordered = [...picks].sort((a, b) => a - b);
  const out = [...blocos];
  // Insert from the end so earlier indices stay valid; number them in reading order.
  [...ordered].reverse().forEach((position) => {
    out.splice(position, 0, { tipo: 'anuncio', formato: '728x90', ordem: ordered.indexOf(position) + 1 });
  });
  return out;
}

const LAYOUT: Record<Article['layout'], Layout> = { standard: 'padrao', overlay: 'overlay', offer: 'oferta' };

export interface MateriaContext {
  siteUrl: string;
  adsPermitidos: boolean;
  maisComoEste: Chamada[];
  maisLink?: { rotulo: string; href: string };
  relacionadas: Chamada[];
  proxima?: Chamada;
  leiaTambem?: Chamada[];
}

export function toMateria(article: Article, ctx: MateriaContext): Materia | null {
  const base = toChamada(article);
  if (!base) return null;
  const layout = LAYOUT[article.layout];
  let blocos = toBlocos(article.body, article.title);
  if (layout !== 'oferta') blocos = withRelatedInline(blocos, ctx.maisComoEste, ctx.maisLink);
  blocos = withAds(blocos, ctx.adsPermitidos);
  const { autores: _cardAuthors, ...rest } = base;
  return {
    ...rest,
    layout,
    lead: article.subtitle ?? article.excerpt,
    ...(article.editedAt && article.editedAt !== article.publishedAt ? { atualizadoEm: article.editedAt } : {}),
    blocos,
    relacionadas: ctx.relacionadas,
    ...(ctx.proxima ? { proxima: ctx.proxima } : {}),
    autores: article.authors.map(toAutor),
    url: `${ctx.siteUrl}${base.href}`,
    ...(ctx.leiaTambem && ctx.leiaTambem.length > 0 ? { leiaTambem: ctx.leiaTambem } : {}),
    afiliados: layout === 'oferta' || article.commercialKind === 'affiliate',
    comercial: layout === 'oferta' || article.commercialKind !== undefined,
    // Affiliate content already carries the affiliate notice; the other kinds say what
    // they are above the text (kit docs/05).
    ...(article.commercial && article.commercial.kind !== 'affiliate'
      ? { divulgacao: { rotulo: DISCLOSURE_LABEL[article.commercial.kind], texto: article.commercial.disclosure } }
      : {}),
  };
}

const DISCLOSURE_LABEL: Record<Exclude<CommercialKind, 'affiliate'>, string> = {
  'branded-content': 'Conteúdo patrocinado',
  campaign: 'Publicidade',
  'review-sample': 'Produto cedido para análise',
};
