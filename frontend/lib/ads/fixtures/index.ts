import { slugify } from "@/lib/content/editorias";
import type { SlotContext, SlotId } from "../slots";

/**
 * Ad server de demonstração. Devolve, por posição, o mesmo corpo que o `GET /v1/ad` real
 * devolveria (ou `null` para 204), com as ofertas temáticas dos protótipos. Preços, links
 * e verificações são fictícios; os links apontam para example.com, como nas fixtures do kit.
 */

type Ratio = "square" | "vertical" | "horizontal";

interface Demo {
  t: string;
  ratio: Ratio | null;
  price: number;
  ref?: number;
  disc?: number;
  /** Minutos desde a última verificação de preço. */
  min: number;
  extra?: Record<string, unknown>;
}

const D: Record<string, Demo> = {
  dualsense: { t: "Controle sem Fio Sony DualSense Edge para PlayStation 5", ratio: "horizontal", price: 1199, ref: 1499, disc: 20, min: 0 },
  dualsenseLongo: { t: "Controle sem Fio Sony DualSense Edge para PlayStation 5 com Gatilhos Ajustáveis", ratio: "horizontal", price: 1199, ref: 1499, disc: 20, min: 0 },
  fireTv: { t: "Fire TV Stick 4K com Controle Remoto por Voz", ratio: "horizontal", price: 379, ref: 499, disc: 24, min: 4 },
  projetor: { t: "Projetor Portátil Full HD com Wi-Fi e Bluetooth", ratio: "horizontal", price: 899.9, ref: 1199.9, disc: 25, min: 8 },
  batman: { t: "Batman: O Longo Dia das Bruxas, encadernado", ratio: "vertical", price: 119.9, min: 18 },
  sandman: { t: "Sandman Edição Definitiva vol. 1, capa dura", ratio: "vertical", price: 199.9, ref: 249.9, disc: 20, min: 12 },
  funko: { t: "Funko Pop! Marvel Homem-Aranha", ratio: "vertical", price: 129.9, min: 6 },
  estante: { t: "Estante para livros com 5 prateleiras", ratio: "vertical", price: 349.9, ref: 449.9, disc: 22, min: 25 },
  demonSlayer: { t: "Box Mangá Demon Slayer vol. 1 a 5", ratio: "square", price: 179.9, ref: 229.9, disc: 22, min: 10 },
  onePiece: { t: "Mangá One Piece vol. 1", ratio: "vertical", price: 39.9, min: 4 },
  goku: { t: "Action figure Goku Super Saiyajin 18 cm", ratio: "vertical", price: 249.9, min: 16 },
  pokebola: { t: "Luminária LED Pokébola", ratio: "square", price: 89.9, ref: 119.9, disc: 25, min: 8 },
  bluray: { t: "Box Blu-ray Trilogia O Senhor dos Anéis Versão Estendida", ratio: "square", price: 249.9, min: 14 },
  pipoqueira: { t: "Pipoqueira Elétrica sem Óleo 1200W", ratio: "square", price: 129.9, ref: 169.9, disc: 24, min: 6 },
  tela: { t: "Tela de Projeção Retrátil 100 polegadas", ratio: "horizontal", price: 389.9, min: 20 },
  smartTv: { t: "Smart TV 50 polegadas 4K UHD com HDR", ratio: "horizontal", price: 2299, min: 11 },
  soundbar: { t: "Soundbar 2.1 com Subwoofer e Bluetooth", ratio: "horizontal", price: 799.9, ref: 999.9, disc: 20, min: 7 },
  fone: { t: "Fone Bluetooth com Cancelamento de Ruído", ratio: "square", price: 349.9, min: 9 },
  pulse: { t: "Headset Gamer sem Fio Sony Pulse 3D Midnight Black", ratio: "square", price: 499.9, min: 5 },
  spiderman: { t: "Marvel's Spider-Man 2 para PS5, mídia física", ratio: "vertical", price: 199.9, ref: 299.9, disc: 33, min: 15 },
  base: { t: "Base de carregamento dupla para controles DualSense", ratio: "horizontal", price: 89.9, min: 3 },
  ps5: {
    t: "Console PlayStation 5 Slim Edição Digital 825GB",
    ratio: "horizontal",
    price: 3299,
    ref: 3799,
    disc: 13,
    min: 12,
    extra: { isOfficialStore: true, historicalPrice: { lowest30d: 3299 }, eyebrow: "Menor preço recente" },
  },
  ssd: { t: "SSD NVMe Kingston Fury Renegade 1TB com Dissipador, PCIe 4.0, compatível com PS5", ratio: "square", price: 549.9, ref: 699.9, disc: 21, min: 12 },
  cabo: { t: "Cabo USB-C trançado 3 m para controle DualSense", ratio: null, price: 39.9, min: 20 },
  stinger: {
    t: "Headset Gamer HyperX Cloud Stinger 2 Core para PS5",
    ratio: "square",
    price: 329.9,
    min: 8,
    extra: { priceDrop: { from: 399.9, percent: 18, since: "nas últimas 24 h" } },
  },
};

type Key = keyof typeof D;

const IMAGE: Record<Ratio, string> = {
  square: "/demo/produto-1x1.svg",
  vertical: "/demo/produto-3x4.svg",
  horizontal: "/demo/produto-16x9.svg",
};

function offer(key: Key, now: number) {
  const d = D[key]!;
  const offerId = slugify(d.t);
  return {
    offerId,
    productTitle: d.t,
    productImage: d.ratio ? IMAGE[d.ratio] : null,
    ...(d.ratio ? { imageRatio: d.ratio } : {}),
    currentPrice: d.price,
    ...(d.ref !== undefined ? { referencePrice: d.ref, discountPercent: d.disc } : {}),
    currency: "BRL",
    merchant: "Shopee",
    checkedAt: new Date(now - d.min * 60_000).toISOString(),
    href: `https://example.com/aff/${offerId}`,
    ...d.extra,
  };
}

/** Faixas temáticas por editoria (protótipo Categorias, `OP.byEd`). */
const POR_EDITORIA: Record<string, [Key, Key, Key, Key]> = {
  cinema: ["projetor", "bluray", "pipoqueira", "tela"],
  "series-e-tv": ["fireTv", "smartTv", "soundbar", "fone"],
  games: ["dualsense", "pulse", "spiderman", "base"],
  quadrinhos: ["sandman", "batman", "funko", "estante"],
  animes: ["demonSlayer", "onePiece", "goku", "pokebola"],
  videos: ["fireTv", "smartTv", "soundbar", "fone"],
  especiais: ["projetor", "bluray", "pipoqueira", "tela"],
};

const NOMES: Record<string, string> = {
  cinema: "cinema",
  "series-e-tv": "séries e TV",
  games: "games",
  quadrinhos: "quadrinhos",
  animes: "animes",
  videos: "vídeos",
  especiais: "especiais",
};

const SLOT_SERVIDOR: Record<SlotId, string> = {
  "home-abertura-side": "sidebar",
  "home-escolha-side": "sidebar",
  "home-feed-sticky": "sidebar",
  "editoria-abertura-side": "sidebar",
  "editoria-feed-sticky": "sidebar",
  "article-sticky": "sidebar",
  "home-grid-cinema": "article-bottom",
  "home-grid-games": "article-bottom",
  "home-grid-series": "article-bottom",
  "home-grid-animes": "article-bottom",
  "home-grid-hq": "article-bottom",
  "editoria-grid": "article-bottom",
  "article-bottom": "article-bottom",
  "home-feed-inline": "article-inline-02",
  "editoria-feed-inline": "article-inline-02",
  "article-inline-02": "article-inline-02",
  "article-inline-03": "article-inline-02",
  "article-drop": "article-inline-02",
  "article-top": "article-top",
  "article-inline-01": "article-inline-01",
};

export function fixtureResponse(slot: SlotId, ctx: SlotContext, now: number): unknown {
  const base = (component: string, props: Record<string, unknown>) => ({
    requestId: `demo-${slot}-${ctx.index ?? 0}`,
    slot: SLOT_SERVIDOR[slot],
    component,
    props,
    tracking: { impressionUrl: "https://example.com/opapreco/impression" },
  });
  const card = (k: Key) => base("product_card_v1", { offer: offer(k, now) });
  const grid = (heading: string, keys: Key[]) => base("product_grid_v1", { heading, offers: keys.map((k) => offer(k, now)) });
  const i = ctx.index ?? 0;
  const ed = ctx.editoria ?? "games";
  const tema = POR_EDITORIA[ed] ?? POR_EDITORIA.games!;
  const layout = ctx.layout ?? "padrao";

  switch (slot) {
    case "home-abertura-side":
      return card("dualsense");
    case "home-escolha-side":
      return card("batman");
    case "home-grid-cinema":
      return grid("Ofertas para fãs de cinema", POR_EDITORIA.cinema!);
    case "home-grid-games":
      return grid("Ofertas em games", POR_EDITORIA.games!);
    case "home-grid-series":
      return grid("Ofertas para maratonar séries", POR_EDITORIA["series-e-tv"]!);
    case "home-grid-animes":
      return grid("Ofertas para fãs de animes", POR_EDITORIA.animes!);
    case "home-grid-hq":
      return grid("Ofertas para leitores de quadrinhos", POR_EDITORIA.quadrinhos!);
    case "home-feed-inline":
      return card((["sandman", "demonSlayer", "pulse"] as const)[i % 3]!);
    case "home-feed-sticky":
      return card(i === 0 ? "fireTv" : "projetor");
    case "editoria-abertura-side":
      return card(tema[0]);
    case "editoria-grid":
      return grid(`Ofertas para fãs de ${NOMES[ed] ?? ed}`, tema);
    case "editoria-feed-inline":
      return card(ed === "cinema" ? "pipoqueira" : tema[(i + 2) % 4]!);
    case "editoria-feed-sticky":
      return card(i === 0 ? "ps5" : "soundbar");
    case "article-top": {
      if (layout === "oferta") return null;
      const k: Key = layout === "overlay" ? "ps5" : "spiderman";
      return base(ctx.viewport === "mobile" ? "product_card_v1" : "product_hero_v1", { offer: offer(k, now) });
    }
    case "article-inline-01":
      if (layout === "overlay")
        return base("contextual_recommendation_v1", {
          context: "Se você está procurando um headset para jogar no PS5",
          contextNote: "Modelo sem fio com áudio 3D, compatível com PS5.",
          offer: offer("pulse", now),
        });
      if (layout === "oferta")
        return base("contextual_recommendation_v1", {
          context: "Se você também procura um headset para jogar no console",
          contextNote: "Headset com fio compatível com PS5.",
          offer: offer("stinger", now),
        });
      return base("contextual_recommendation_v1", {
        context: "Para quem vai jogar Marvel's Spider-Man 2 no PS5",
        contextNote: "Controle com gatilhos ajustáveis e botões traseiros remapeáveis, compatível com PS5.",
        offer: offer("dualsenseLongo", now),
      });
    case "article-inline-02":
      return card(layout === "overlay" ? "fireTv" : layout === "oferta" ? "base" : "projetor");
    case "article-drop":
      // Sem queda comprovada, o servidor manda um card no lugar (spec §4).
      if (layout === "oferta") return null;
      return layout === "overlay" ? card("spiderman") : base("price_drop_v1", { offer: offer("stinger", now) });
    case "article-inline-03":
      return card(layout === "overlay" ? "pipoqueira" : layout === "oferta" ? "pulse" : "funko");
    case "article-sticky":
      return card("dualsense");
    case "article-bottom":
      if (layout === "oferta") return grid("Mais ofertas para gamers", ["pulse", "dualsenseLongo", "spiderman", "base"]);
      return grid(
        "Ofertas para o seu PS5",
        layout === "overlay" ? ["dualsenseLongo", "ssd", "base", "cabo"] : ["ssd", "pulse", "base", "cabo"],
      );
  }
}

/** Ofertas avulsas para a vitrine de componentes (/dev/opapreco). */
export function demoOffer(key: Key, now: number) {
  return offer(key, now);
}
export type DemoKey = Key;
