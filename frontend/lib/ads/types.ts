import { z } from "zod";

/**
 * Contratos do OpaPreço Ads (opapreco/offer.schema.json e ad-response.schema.json),
 * validados em tempo de execução: nada que venha do ad server chega aos componentes sem
 * passar por aqui. A validação é estrutural; título curto, desconto abaixo de 5% e queda
 * sem prova passam pelo esquema e são tratados pelas regras (lib/ads/rules.ts), que
 * escondem o desconto ou devolvem 204 conforme a spec.
 */
/** Só https: o ad server não pode mandar o leitor nem o navegador para http:, data: etc. */
const httpsUrl = z
  .string()
  .url()
  .refine((s) => s.startsWith("https://"), "precisa ser https");

export const OfferSchema = z
  .object({
    offerId: z.string().min(1),
    productTitle: z.string(),
    // URL absoluta do ad server; caminho local só nas fixtures de demonstração.
    productImage: z
      .string()
      .refine((s) => s.startsWith("https://") || s.startsWith("/"), "imagem precisa ser https")
      .nullable()
      .optional(),
    imageRatio: z.enum(["square", "vertical", "horizontal"]).optional(),
    currentPrice: z.number().positive(),
    referencePrice: z.number().positive().optional(),
    discountPercent: z.number().int().min(0).max(90).optional(),
    currency: z.literal("BRL").optional(),
    merchant: z.literal("Shopee"),
    isOfficialStore: z.boolean().optional(),
    checkedAt: z.string().datetime({ offset: true }),
    href: httpsUrl,
    cta: z.string().max(28).optional(),
    ctaShort: z.string().max(14).optional(),
    eyebrow: z.enum(["Oferta verificada", "Menor preço recente", "Boa oportunidade"]).optional(),
    affiliateDisclosure: z.enum(["Link de afiliado", "Oferta afiliada", "Links de afiliado"]).optional(),
    priceDrop: z
      .object({
        from: z.number().positive(),
        percent: z.number().int().min(0).max(90),
        since: z.string().max(32).optional(),
      })
      .strict()
      .optional(),
    historicalPrice: z.object({ lowest30d: z.number().positive().optional() }).strict().optional(),
    dealScore: z.number().min(0).max(100).optional(),
  })
  .strict()
  .refine((o) => (o.discountPercent === undefined) === (o.referencePrice === undefined), {
    message: "discountPercent e referencePrice andam juntos",
  });

export type OfferData = z.infer<typeof OfferSchema>;

export const COMPONENTS = [
  "product_card_v1",
  "product_compact_v1",
  "product_hero_v1",
  "product_grid_v1",
  "price_drop_v1",
  "contextual_recommendation_v1",
] as const;
export type AdComponent = (typeof COMPONENTS)[number];

export const SERVER_SLOTS = [
  "article-top",
  "article-inline-01",
  "article-inline-02",
  "article-bottom",
  "sidebar",
] as const;
export type ServerSlot = (typeof SERVER_SLOTS)[number];

const SingleProps = z.object({ offer: OfferSchema }).strict();
const ContextualProps = z
  .object({
    offer: OfferSchema,
    context: z.string().min(1).max(90),
    contextNote: z.string().max(140).optional(),
  })
  .strict();
// Cada oferta da grade é validada uma a uma nas regras: uma oferta fora do contrato sai,
// as outras ficam.
const GridProps = z
  .object({ heading: z.string().max(48).optional(), offers: z.array(z.unknown()).min(2).max(4) })
  .strict();

const Tracking = z.object({ impressionUrl: httpsUrl, viewUrl: httpsUrl.optional() });
const Common = {
  requestId: z.string(),
  slot: z.enum(SERVER_SLOTS),
  reserveHeight: z.number().int().optional(),
  tracking: Tracking,
  expiresAt: z.string().datetime({ offset: true }).optional(),
};

/** Resposta 200 do `GET /v1/ad`; 204 não tem corpo. */
export const AdResponseSchema = z.discriminatedUnion("component", [
  z.object({ ...Common, component: z.literal("product_card_v1"), props: SingleProps }).strict(),
  z.object({ ...Common, component: z.literal("product_compact_v1"), props: SingleProps }).strict(),
  z.object({ ...Common, component: z.literal("product_hero_v1"), props: SingleProps }).strict(),
  z.object({ ...Common, component: z.literal("price_drop_v1"), props: SingleProps }).strict(),
  z
    .object({ ...Common, component: z.literal("contextual_recommendation_v1"), props: ContextualProps })
    .strict(),
  z.object({ ...Common, component: z.literal("product_grid_v1"), props: GridProps }).strict(),
]);
export type AdResponse = z.infer<typeof AdResponseSchema>;

/** O que o slot recebe depois das regras: um componente pronto ou nada (204). */
export type AdResult =
  | { status: 204 }
  | {
      status: 200;
      /** Instante em que a resposta foi montada (base de "verificado há X min"). */
      servedAt: string;
      expiresAt?: string;
      impressionUrl?: string;
      render:
        | {
            component: "product_card_v1" | "product_compact_v1" | "product_hero_v1" | "price_drop_v1";
            offer: OfferData;
          }
        | {
            component: "contextual_recommendation_v1";
            offer: OfferData;
            context: string;
            contextNote?: string;
          }
        | { component: "product_grid_v1"; offers: OfferData[]; heading?: string };
    };

export type AdRender = Extract<AdResult, { status: 200 }>["render"];
