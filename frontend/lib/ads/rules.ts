import { AdResponseSchema, type AdRender, type AdResponse, type AdResult, type OfferData } from "./types";

/**
 * Regras de exibição de preço do OpaPreço (OPAPRECO_ADS_SPEC.md §4, §12). O backend já
 * deveria aplicá-las; o front aplica de novo, porque uma oferta desonesta exibida é pior
 * que um slot vazio.
 */

import { MAX_AGE_MS, MIN_DISCOUNT } from "./constants";

export { MAX_AGE_MS, MIN_DISCOUNT };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 299,90" */
export function formatBRL(value: number): string {
  return BRL.format(value);
}

/** "−17%" com o sinal de menos (U+2212), nunca hífen. */
export function discountLabel(percent: number): string {
  return `−${percent}%`;
}

/** Desconto só com prova: referência maior que o preço e pelo menos 5%. */
export function hasDiscount(o: Pick<OfferData, "currentPrice" | "referencePrice" | "discountPercent">): boolean {
  return (
    o.referencePrice !== undefined &&
    o.discountPercent !== undefined &&
    o.discountPercent >= MIN_DISCOUNT &&
    o.referencePrice > o.currentPrice
  );
}

/** Queda comprovada: preço anterior maior que o atual e pelo menos 5%. */
export function hasValidPriceDrop(o: Pick<OfferData, "currentPrice" | "priceDrop">): boolean {
  return !!o.priceDrop && o.priceDrop.from > o.currentPrice && o.priceDrop.percent >= MIN_DISCOUNT;
}

export function isLowest30d(o: Pick<OfferData, "currentPrice" | "historicalPrice">): boolean {
  const low = o.historicalPrice?.lowest30d;
  return low !== undefined && o.currentPrice <= low;
}

function ageMs(checkedAt: string, now: number): number {
  return now - Date.parse(checkedAt);
}

/**
 * Oferta servível: título, preço positivo, link e verificação de no máximo 6 h. Uma oferta
 * que alega queda de preço sem prova (fixture `fakeDrop`) não é servida em formato nenhum.
 */
export function isServable(o: Partial<OfferData> | null | undefined, now: number): o is OfferData {
  if (!o) return false;
  if (!o.productTitle || o.productTitle.trim().length < 3) return false;
  if (!(typeof o.currentPrice === "number" && o.currentPrice > 0)) return false;
  if (!o.href) return false;
  if (!o.checkedAt) return false;
  if (o.priceDrop && !hasValidPriceDrop({ currentPrice: o.currentPrice, priceDrop: o.priceDrop })) return false;
  const age = ageMs(o.checkedAt, now);
  return Number.isFinite(age) && age >= -60_000 && age <= MAX_AGE_MS;
}

/** "Preço verificado agora" · "há 12 min" · "há 3 h". Acima de 6 h: null (não servir). */
export function checkedLabel(checkedAt: string, now: number, lower = false): string | null {
  const min = Math.max(0, Math.floor(ageMs(checkedAt, now) / 60_000));
  if (min > 6 * 60) return null;
  const p = lower ? "preço verificado" : "Preço verificado";
  if (min < 1) return `${p} agora`;
  if (min < 60) return `${p} há ${min} min`;
  return `${p} há ${Math.floor(min / 60)} h`;
}

/** Remove o desconto não comprovado em vez de descartar a oferta (só o preço atual aparece). */
export function sanitizeOffer(o: OfferData): OfferData {
  if (hasDiscount(o)) return o;
  const { referencePrice: _r, discountPercent: _d, ...rest } = o;
  return rest as OfferData;
}

export function eyebrowFor(o: OfferData): string {
  if (o.eyebrow) return o.eyebrow;
  return isLowest30d(o) ? "Menor preço recente" : "Oferta verificada";
}

/**
 * Aplica as regras a uma resposta do ad server:
 *  - oferta vencida (> 6 h), sem título, sem preço ou sem link → 204;
 *  - price_drop_v1 sem queda comprovada → 204;
 *  - grade com menos de 2 ofertas servíveis → 204 (máx. 4);
 *  - desconto < 5% ou referência ≤ preço → mantém a oferta só com o preço atual.
 */
export function applyRules(resp: AdResponse, now: number): AdResult {
  const servedAt = new Date(now).toISOString();
  const meta = { servedAt, expiresAt: resp.expiresAt, impressionUrl: resp.tracking.impressionUrl };
  let render: AdRender;
  switch (resp.component) {
    case "product_grid_v1": {
      const offers = resp.props.offers.filter((o) => isServable(o, now)).map(sanitizeOffer).slice(0, 4);
      if (offers.length < 2) return { status: 204 };
      render = { component: "product_grid_v1", offers, heading: resp.props.heading };
      break;
    }
    case "contextual_recommendation_v1": {
      const { offer, context, contextNote } = resp.props;
      if (!isServable(offer, now) || !context.trim()) return { status: 204 };
      render = { component: "contextual_recommendation_v1", offer: sanitizeOffer(offer), context, contextNote };
      break;
    }
    case "price_drop_v1": {
      const { offer } = resp.props;
      if (!isServable(offer, now) || !hasValidPriceDrop(offer)) return { status: 204 };
      render = { component: "price_drop_v1", offer: sanitizeOffer(offer) };
      break;
    }
    default: {
      const { offer } = resp.props;
      if (!isServable(offer, now)) return { status: 204 };
      render = { component: resp.component, offer: sanitizeOffer(offer) };
    }
  }
  return { status: 200, ...meta, render };
}

/** Corpo cru do ad server → resultado final. Corpo inválido conta como vazio (204). */
export function resolveResponse(raw: unknown, now: number): AdResult {
  const parsed = AdResponseSchema.safeParse(raw);
  if (!parsed.success) return { status: 204 };
  return applyRules(parsed.data, now);
}
