import type { AdComponent, ServerSlot } from "./types";

/**
 * Posições OpaPreço do Máquina Nerd (docs/05-publicidade.md). O id é o do publisher; o ad
 * server conhece cinco slots (ad-response.schema.json), então cada posição informa também
 * o slot do servidor — a requisição leva os dois (`slot` e `placement`).
 */
export type SlotId =
  | "home-abertura-side"
  | "home-grid-cinema"
  | "home-grid-games"
  | "home-grid-series"
  | "home-grid-animes"
  | "home-grid-hq"
  | "home-escolha-side"
  | "home-feed-inline"
  | "home-feed-sticky"
  | "editoria-abertura-side"
  | "editoria-grid"
  | "editoria-feed-inline"
  | "editoria-feed-sticky"
  | "article-top"
  | "article-inline-01"
  | "article-inline-02"
  | "article-inline-03"
  | "article-drop"
  | "article-bottom"
  | "article-sticky";

export interface SlotConfig {
  server: ServerSlot;
  /** Componente esperado: decide a geometria do esqueleto e da reserva de altura. */
  esperado: AdComponent;
  /** Lateral: só existe a partir de 1024px. */
  sidebar?: boolean;
}

export const SLOTS: Record<SlotId, SlotConfig> = {
  "home-abertura-side": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
  "home-grid-cinema": { server: "article-bottom", esperado: "product_grid_v1" },
  "home-grid-games": { server: "article-bottom", esperado: "product_grid_v1" },
  "home-grid-series": { server: "article-bottom", esperado: "product_grid_v1" },
  "home-grid-animes": { server: "article-bottom", esperado: "product_grid_v1" },
  "home-grid-hq": { server: "article-bottom", esperado: "product_grid_v1" },
  "home-escolha-side": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
  "home-feed-inline": { server: "article-inline-02", esperado: "product_card_v1" },
  "home-feed-sticky": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
  "editoria-abertura-side": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
  "editoria-grid": { server: "article-bottom", esperado: "product_grid_v1" },
  "editoria-feed-inline": { server: "article-inline-02", esperado: "product_card_v1" },
  "editoria-feed-sticky": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
  "article-top": { server: "article-top", esperado: "product_hero_v1" },
  "article-inline-01": { server: "article-inline-01", esperado: "contextual_recommendation_v1" },
  "article-inline-02": { server: "article-inline-02", esperado: "product_card_v1" },
  "article-inline-03": { server: "article-inline-02", esperado: "product_card_v1" },
  "article-drop": { server: "article-inline-02", esperado: "price_drop_v1" },
  "article-bottom": { server: "article-bottom", esperado: "product_grid_v1" },
  "article-sticky": { server: "sidebar", esperado: "product_card_v1", sidebar: true },
};

export type Viewport = "mobile" | "tablet" | "desktop";

export interface SlotContext {
  /** Caminho da página (o ad server recebe a URL absoluta). */
  path: string;
  editoria?: string;
  tags?: string[];
  layout?: "padrao" | "overlay" | "oferta";
  viewport?: Viewport;
  /** Largura do contêiner em px, para o ad server escolher o formato. */
  containerWidth?: number;
  /** n-ésima ocorrência da mesma posição na página (lista com card a cada 3 itens, laterais duplas). */
  index?: number;
}

/**
 * Reserva de altura do esqueleto (spec §5 e docs/05), por componente e orientação.
 * Componentes renderizados no servidor não usam reserva: já chegam com a altura real.
 */
export const RESERVE: Record<AdComponent, { wide: number; narrow: number }> = {
  product_card_v1: { wide: 194, narrow: 416 },
  product_compact_v1: { wide: 88, narrow: 88 },
  product_hero_v1: { wide: 344, narrow: 642 },
  product_grid_v1: { wide: 460, narrow: 682 },
  price_drop_v1: { wide: 216, narrow: 352 },
  contextual_recommendation_v1: { wide: 270, narrow: 370 },
};
