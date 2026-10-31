import { MAX_AGE_MS, MIN_DISCOUNT } from "./constants";
import {
  AdResponseSchema,
  OfferSchema,
  type AdRender,
  type AdResponse,
  type AdResult,
  type OfferData,
} from "./types";

/**
 * Regras de exibição de preço do OpaPreço (OPAPRECO_ADS_SPEC.md §4, §12). O backend já
 * deveria aplicá-las; o front aplica de novo, porque uma oferta desonesta exibida é pior
 * que um slot vazio.
 */

export { MAX_AGE_MS, MIN_DISCOUNT };

/** Diferença máxima, em pontos, entre o percentual informado e o calculado pelos preços. */
const TOLERANCIA_PCT = 1;
/** "Boa oportunidade" só com desconto comprovado de pelo menos 10% (spec §12). */
const BOA_OPORTUNIDADE_PCT = 10;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 299,90" */
export function formatBRL(value: number): string {
  return BRL.format(value);
}

/** "−17%" com o sinal de menos (U+2212), nunca hífen. */
export function discountLabel(percent: number): string {
  return `${String.fromCharCode(0x2212)}${percent}%`;
}

/** Percentual que os próprios preços sustentam (arredondado, como o backend calcula). */
function percentual(de: number, por: number): number {
  return Math.round(((de - por) / de) * 100);
}

/**
 * Percentual comprovado: o "de" é maior que o "por", a queda calculada é de pelo menos 5%
 * e o percentual informado bate com ela (até 1 ponto de arredondamento). "−40%" sobre uma
 * queda real de 3% não passa.
 */
function comprovado(de: number, por: number, informado: number): boolean {
  if (!(de > por)) return false;
  const real = percentual(de, por);
  return real >= MIN_DISCOUNT && informado >= MIN_DISCOUNT && Math.abs(real - informado) <= TOLERANCIA_PCT;
}

/** Desconto só com prova: referência maior que o preço, ao menos 5% e percentual coerente. */
export function hasDiscount(
  o: Pick<OfferData, "currentPrice" | "referencePrice" | "discountPercent">,
): boolean {
  return (
    o.referencePrice !== undefined &&
    o.discountPercent !== undefined &&
    comprovado(o.referencePrice, o.currentPrice, o.discountPercent)
  );
}

/** Queda comprovada: preço anterior maior que o atual, ao menos 5% e percentual coerente. */
export function hasValidPriceDrop(o: Pick<OfferData, "currentPrice" | "priceDrop">): boolean {
  return !!o.priceDrop && comprovado(o.priceDrop.from, o.currentPrice, o.priceDrop.percent);
}

export function isLowest30d(o: Pick<OfferData, "currentPrice" | "historicalPrice">): boolean {
  const low = o.historicalPrice?.lowest30d;
  return low !== undefined && o.currentPrice <= low;
}

function ageMs(checkedAt: string, now: number): number {
  return now - Date.parse(checkedAt);
}

/**
 * Hosts aceitos no link afiliado (`OPAPRECO_ALLOWED_HOSTS`, separados por vírgula; um host
 * cobre os subdomínios). Sem a variável, qualquer host https — o contrato já exige https.
 */
function hostPermitido(href: string): boolean {
  const lista = (process.env.OPAPRECO_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (!lista.length) return true;
  try {
    const host = new URL(href).hostname.toLowerCase();
    return lista.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Oferta servível: título, preço positivo, link https permitido e verificação de no máximo
 * 6 h. Uma oferta que alega queda de preço sem prova (fixture `fakeDrop`) não é servida em
 * formato nenhum.
 */
export function isServable(o: Partial<OfferData> | null | undefined, now: number): o is OfferData {
  if (!o) return false;
  if (!o.productTitle || o.productTitle.trim().length < 3) return false;
  if (!(typeof o.currentPrice === "number" && o.currentPrice > 0)) return false;
  if (!o.href || !o.href.startsWith("https://") || !hostPermitido(o.href)) return false;
  if (!o.checkedAt) return false;
  if (o.priceDrop && !hasValidPriceDrop({ currentPrice: o.currentPrice, priceDrop: o.priceDrop }))
    return false;
  const age = ageMs(o.checkedAt, now);
  return Number.isFinite(age) && age >= -60_000 && age <= MAX_AGE_MS;
}

export { checkedLabel } from "./labels";

/**
 * Remove o desconto não comprovado em vez de descartar a oferta (só o preço atual aparece)
 * e troca o selo que não tem prova pelo neutro.
 */
export function sanitizeOffer(o: OfferData): OfferData {
  const comDesconto = hasDiscount(o);
  const { referencePrice: _r, discountPercent: _d, eyebrow: _e, ...rest } = o;
  const base = (
    comDesconto ? { ...rest, referencePrice: o.referencePrice, discountPercent: o.discountPercent } : rest
  ) as OfferData;
  const eyebrow = eyebrowFor(base, o.eyebrow);
  return { ...base, eyebrow };
}

/**
 * Selo do topo do card/hero (spec §12): "Menor preço recente" só se o preço atual é o menor
 * dos últimos 30 dias; "Boa oportunidade" só com desconto comprovado de 10% ou mais; nos
 * demais casos, "Oferta verificada" — o que o servidor pedir sem prova vira o neutro.
 */
export function eyebrowFor(
  o: OfferData,
  pedido: OfferData["eyebrow"] = o.eyebrow,
): NonNullable<OfferData["eyebrow"]> {
  const menor = isLowest30d(o);
  const boa = hasDiscount(o) && (o.discountPercent ?? 0) >= BOA_OPORTUNIDADE_PCT;
  if (pedido === "Menor preço recente") return menor ? pedido : "Oferta verificada";
  if (pedido === "Boa oportunidade") return boa ? pedido : "Oferta verificada";
  if (pedido === "Oferta verificada") return pedido;
  return menor ? "Menor preço recente" : "Oferta verificada";
}

/**
 * Aplica as regras a uma resposta do ad server:
 *  - oferta vencida (> 6 h), sem título, sem preço ou com link fora do permitido → 204;
 *  - price_drop_v1 sem queda comprovada → 204;
 *  - grade: cada oferta é validada sozinha; com 3 servíveis mostra 2 (a grade é par), com
 *    menos de 2 → 204;
 *  - desconto sem prova (abaixo de 5%, referência ≤ preço ou percentual que os preços não
 *    sustentam) → mantém a oferta só com o preço atual.
 */
export function applyRules(resp: AdResponse, now: number): AdResult {
  const servedAt = new Date(now).toISOString();
  const meta = { servedAt, expiresAt: resp.expiresAt, impressionUrl: resp.tracking.impressionUrl };
  let render: AdRender;
  switch (resp.component) {
    case "product_grid_v1": {
      const validas = resp.props.offers.flatMap((raw) => {
        const parsed = OfferSchema.safeParse(raw);
        return parsed.success && isServable(parsed.data, now) ? [sanitizeOffer(parsed.data)] : [];
      });
      const offers = validas.slice(0, validas.length >= 4 ? 4 : 2);
      if (offers.length < 2) return { status: 204 };
      render = { component: "product_grid_v1", offers, heading: resp.props.heading };
      break;
    }
    case "contextual_recommendation_v1": {
      const { offer, context, contextNote } = resp.props;
      if (!isServable(offer, now) || !context.trim()) return { status: 204 };
      render = {
        component: "contextual_recommendation_v1",
        offer: sanitizeOffer(offer),
        context,
        contextNote,
      };
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
