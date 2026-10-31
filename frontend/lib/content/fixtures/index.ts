import { paginate, POR_PAGINA, type ContentAdapter, type HomeData, type MateriaRef } from "../adapter";
import { EDITORIAS, editoriaRef, slugify } from "../editorias";
import type { Bloco, Chamada, EditoriaSlug, Layout, Materia, Patrocinado, Produto, Trecho } from "../types";
import { AUTORES, ROWS, type ChamadaRow } from "./chamadas";
import {
  CORPO_OVERLAY,
  CORPO_PADRAO,
  CORPO_PUBLI,
  LEAD_OVERLAY,
  LEAD_PADRAO,
  LEAD_PUBLI,
  type BlocoFixture,
} from "./corpos";
import { IMG, type ImgKey } from "./imagens";

/**
 * Adaptador de demonstração. Monta tudo a partir das linhas de `chamadas.ts`, com datas
 * relativas ao instante `agora` recebido. Os textos completos das três matérias vêm dos
 * protótipos; as demais matérias reaproveitam esses corpos (a faixa de demonstração avisa).
 */

const OVERLAY = new Set(["como-scarlett-johansson-virou-o-centro-de-um-mito"]);

function hrefOf(row: ChamadaRow): string {
  return row.formato === "oferta" ? `/ofertas/${row.slug}` : `/${row.ed}/${row.slug}`;
}

function layoutOf(row: ChamadaRow): Layout {
  if (row.formato === "oferta") return "oferta";
  return OVERLAY.has(row.slug) ? "overlay" : "padrao";
}

function toChamada(row: ChamadaRow, now: number): Chamada {
  return {
    id: row.slug,
    href: hrefOf(row),
    titulo: row.titulo,
    resumo: row.resumo,
    imagem: IMG[row.img],
    editoria: editoriaRef(row.ed),
    assunto: row.assunto,
    publicadoEm: new Date(now - row.min * 60_000).toISOString(),
    autores: row.autores.map((a) => ({ nome: AUTORES[a].nome, slug: AUTORES[a].slug })),
    formato: row.formato,
  };
}

class Catalog {
  readonly all: Chamada[];
  private readonly bySlug = new Map<string, Chamada>();

  constructor(readonly now: number) {
    this.all = ROWS.map((r) => toChamada(r, now));
    for (const c of this.all) this.bySlug.set(c.id, c);
  }

  get(slug: string): Chamada {
    const c = this.bySlug.get(slug);
    if (!c) throw new Error(`Fixture inexistente: ${slug}`);
    return c;
  }

  pick(...slugs: string[]): Chamada[] {
    return slugs.map((s) => this.get(s));
  }

  /** Notícias (sem as matérias de oferta), da mais recente para a mais antiga. */
  latest(filter: (c: Chamada) => boolean = () => true): Chamada[] {
    return this.all
      .filter((c) => c.formato !== "oferta" && filter(c))
      .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
  }
}

function home(cat: Catalog): HomeData {
  return {
    agora: new Date(cat.now).toISOString(),
    abertura: {
      manchete: cat.get("resident-evil-2026-monstro-classico"),
      destaques: cat.pick(
        "netflix-trailer-lego-one-piece",
        "billy-bob-thornton-texas-taylor-sheridan",
        "hlin-johannsdottir-alief-just-a-kid",
      ),
      lateral: cat.pick(
        "lanterns-9-milhoes-estreia-hbo",
        "pirates-of-the-caribbean-negociacoes-johnny-depp",
        "cameron-diaz-estrela-bad-day",
        "tom-hardy-explica-o-novo-taboo",
      ),
    },
    cinema: {
      cards: cat.pick(
        "o-misterio-de-jack-sparrow",
        "star-trek-bonecos-strange-new-worlds",
        "colombiana-destaque-streaming-zoe-saldana",
        "taboo-tom-hardy-sherlock-holmes",
      ),
      grandes: cat.pick("scarlett-johansson-volta-ao-mcu", "lanterns-segunda-temporada-aprovada"),
    },
    games: cat.latest((c) => c.editoria.slug === "games").slice(0, 4),
    series: {
      manchete: cat.get("identidade-pelas-series-que-acompanhamos"),
      destaques: cat.pick(
        "my-brilliant-career-top-10-netflix",
        "mighty-boosh-comedia-surrealista",
        "just-a-kid-cinema-islandes-no-brasil",
      ),
    },
    quadrinhos: cat.latest((c) => c.editoria.slug === "quadrinhos").slice(0, 4),
    animes: cat.pick(
      "lego-one-piece-tudo-o-que-sabemos",
      "president-curtis-segunda-temporada",
      "series-que-moldaram-o-humor-absurdo",
    ),
    videos: {
      destaque: cat.get("ahsoka-trailer-segunda-temporada-thrawn"),
      recomendados: cat.pick(
        "strange-new-worlds-recriou-bonecos",
        "tom-hardy-explica-o-novo-taboo",
        "colombiana-por-que-voltou-ao-top-10",
        "bad-day-bastidores-cameron-diaz",
        "trailer-ahsoka-segunda-temporada",
        "trailer-lego-one-piece-especial-netflix",
        "teaser-resident-evil-2026",
        "entrevista-jerry-bruckheimer-piratas-do-caribe",
      ),
      recentes: cat.latest((c) => c.formato === "video" && c.id !== "ahsoka-trailer-segunda-temporada-thrawn"),
      // Sem dado de audiência nas fixtures: a aba "Mais vistos" não aparece.
    },
  };
}

function inline(texto: string): Trecho[] {
  return [{ tipo: "texto", texto }];
}

function produtoXbox(): Produto {
  return {
    nome: "Controle Sem Fio Xbox — edição especial",
    imagem: { url: "/demo/produto-1x1.svg", alt: "Controle Sem Fio Xbox — edição especial (imagem ilustrativa)", largura: 600, altura: 600 },
    descricao:
      "Superfícies esculpidas, geometria refinada, botão direcional híbrido e aderência texturizada nos gatilhos. Compatível com Xbox Series X|S, Xbox One e PC.",
    precoAtual: "R$ 349,90",
    precoAnterior: "R$ 499,90",
    demonstracao: true,
    ofertas: [
      { loja: "Amazon", url: "https://example.com/aff/amazon/controle-xbox", preco: "R$ 349,90" },
      { loja: "Mercado Livre", url: "https://example.com/aff/mercado-livre/controle-xbox", preco: "R$ 359,00" },
    ],
  };
}

const PATROCINADOS: (Omit<Patrocinado, "imagem"> & { img: ImgKey })[] = [
  { id: "cadeiras", titulo: "Cadeiras gamer com até 30% de desconto nesta semana", href: "https://example.com/patrocinado/cadeiras-gamer", parceiro: "Parceiro · Patrocinado", img: "shooter" },
  { id: "ssd", titulo: "SSD NVMe 1TB: os modelos mais buscados de setembro", href: "https://example.com/patrocinado/ssd-nvme", parceiro: "Parceiro · Patrocinado", img: "bad" },
  { id: "monitores", titulo: "Monitores 144Hz para quem joga no PC", href: "https://example.com/patrocinado/monitores-144hz", parceiro: "Parceiro · Patrocinado", img: "re" },
  { id: "headsets", titulo: "Headsets sem fio: guia rápido de compra", href: "https://example.com/patrocinado/headsets", parceiro: "Parceiro · Patrocinado", img: "kid" },
];

function resolveBlocos(corpo: BlocoFixture[], m: { mais: Bloco; flutuante?: Bloco; produto?: Bloco }): Bloco[] {
  const out: Bloco[] = [];
  for (const b of corpo) {
    if (b.tipo === "@mais") out.push(m.mais);
    else if (b.tipo === "@flutuante") {
      if (m.flutuante) out.push(m.flutuante);
    } else if (b.tipo === "@produto") {
      if (m.produto) out.push(m.produto);
    } else out.push(b);
  }
  return out;
}

function materia(cat: Catalog, row: ChamadaRow): Materia & { agora: string } {
  const base = cat.get(row.slug);
  const layout = layoutOf(row);
  const ed = EDITORIAS[row.ed];
  const outros = (f: (c: Chamada) => boolean) => cat.latest((c) => c.id !== row.slug && f(c));

  const mesmaEditoria = outros((c) => c.editoria.slug === row.ed);
  const especial = row.slug === "o-misterio-de-scarlett-johansson" || layout === "overlay";
  const maisItens = especial
    ? cat.pick("imagens-que-fizeram-de-lanterns-um-icone", "o-falso-mito-de-jack-sparrow", "falsos-vingadores-america-do-sul")
    : mesmaEditoria.slice(0, 3);
  const assuntoSlug = row.assunto ? slugify(row.assunto) : undefined;
  const assuntoValido = assuntoSlug && ed.assuntos.some((a) => slugify(a) === assuntoSlug);
  const mais: Bloco = {
    tipo: "relacionadas-inline",
    itens: maisItens,
    imagem: maisItens[0]?.imagem,
    maisHref: assuntoValido ? `/${row.ed}/assunto/${assuntoSlug}` : `/${row.ed}`,
    maisRotulo: assuntoValido ? `Tudo sobre ${row.assunto}` : `Todo o ${ed.nome}`,
  };

  const relacionadas = [...mesmaEditoria.slice(0, 3), ...outros((c) => c.editoria.slug !== row.ed)].slice(0, 6);
  const proxima = outros((c) => c.formato === "critica" || c.formato === "reportagem").find(
    (c) => c.editoria.slug !== row.ed,
  );

  const lead =
    row.slug === "o-misterio-de-scarlett-johansson"
      ? LEAD_PADRAO
      : layout === "overlay"
        ? LEAD_OVERLAY
        : row.slug === "controle-xbox-edicao-especial-queda-de-preco"
          ? LEAD_PUBLI
          : inline(row.resumo ?? row.titulo);

  const autor = AUTORES[row.autores[0] ?? "rafael-lima"];
  const comum = {
    ...base,
    agora: new Date(cat.now).toISOString(),
    layout,
    lead,
    relacionadas,
    proxima,
    autorDetalhe: autor,
    tags: [ed.nome, ...(row.assunto ? [row.assunto] : [])],
  };

  if (layout === "oferta") {
    const ofertas = cat.all.filter((c) => c.formato === "oferta" && c.id !== row.slug);
    return {
      ...comum,
      imagem: undefined,
      blocos: resolveBlocos(CORPO_PUBLI, {
        mais,
        flutuante: { tipo: "relacionado-flutuante", item: cat.get("headsets-xbox-pc-desconto-setembro") },
        produto: { tipo: "produto", produto: produtoXbox() },
      }),
      leiaTambem: { topo: ofertas[0], fim: ofertas[1] },
      patrocinados: PATROCINADOS.map(({ img, ...p }) => ({ ...p, imagem: { ...IMG[img], alt: "" } })),
    };
  }

  return {
    ...comum,
    imagem: base.imagem && { ...base.imagem, credito: base.imagem.credito ?? "Crédito da imagem: divulgação" },
    atualizadoEm:
      row.slug === "o-misterio-de-scarlett-johansson"
        ? new Date(cat.now - (row.min - 15 * 60) * 60_000).toISOString()
        : undefined,
    notaFinal:
      row.slug === "o-misterio-de-scarlett-johansson" || layout === "overlay"
        ? "Viúva Negra: Edição Definitiva (2021–2026) está disponível no Disney+."
        : undefined,
    blocos: resolveBlocos(layout === "overlay" ? CORPO_OVERLAY : CORPO_PADRAO, { mais }),
  };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function fixtureAdapter(now: number): ContentAdapter {
  const cat = new Catalog(now);
  const agora = new Date(now).toISOString();
  const row = (slug: string) => ROWS.find((r) => r.slug === slug);

  return {
    async home() {
      return home(cat);
    },
    async feed(pagina) {
      return { ...paginate(cat.latest(), pagina), agora };
    },
    async editoria(slug: EditoriaSlug, { assunto, pagina }) {
      const editoria = EDITORIAS[slug];
      const doEditoria = cat.latest((c) => c.editoria.slug === slug);
      if (assunto) {
        const filtrados = doEditoria.filter((c) => c.assunto && slugify(c.assunto) === slugify(assunto));
        return { agora, editoria, assunto, feed: paginate(filtrados, pagina) };
      }
      const [manchete, ...resto] = doEditoria;
      if (!manchete) return { agora, editoria, feed: paginate([], 1) };
      const abertura = { manchete, destaques: resto.slice(0, 3), lateral: resto.slice(3, 7) };
      return { agora, editoria, abertura: pagina === 1 ? abertura : undefined, feed: paginate(resto.slice(7), pagina) };
    },
    async materia(editoria, slug) {
      const r = row(slug);
      if (!r || r.formato === "oferta" || r.ed !== editoria) return null;
      return materia(cat, r);
    },
    async oferta(slug) {
      const r = row(slug);
      if (!r || r.formato !== "oferta") return null;
      return materia(cat, r);
    },
    async busca(q, pagina) {
      const termo = normalize(q.trim());
      if (!termo) return { ...paginate([], 1), agora };
      const hits = cat
        .latest()
        .filter((c) => normalize([c.titulo, c.resumo, c.assunto, c.editoria.nome].filter(Boolean).join(" ")).includes(termo));
      return { ...paginate(hits, pagina, POR_PAGINA), agora };
    },
    async todas(): Promise<MateriaRef[]> {
      return cat.all.map((c) => ({
        editoria: c.editoria.slug,
        slug: c.id,
        layout: layoutOf(row(c.id)!),
        publicadoEm: c.publicadoEm,
      }));
    },
  };
}
