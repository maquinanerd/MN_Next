import type { OfferData } from "@/lib/ads/types";
import { formatBRL, hasValidPriceDrop } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, MetaLine, OfferImage } from "./parts";

/**
 * 5.5 — só com queda comprovada (≥ 5%), no máximo um por página. A queda é dita por texto,
 * seta e preço riscado; o percentual (13px) é menor que o preço. Sem vermelho.
 */
export function PriceDropV1({
  offer,
  servedAt,
  expiresAt,
  estado,
}: {
  offer: OfferData;
  servedAt: string;
  expiresAt?: string;
  estado?: EstadoForcado;
}) {
  if (!offer.priceDrop || !hasValidPriceDrop(offer)) return null;
  const { from, percent, since } = offer.priceDrop;
  const disclosure = offer.affiliateDisclosure ?? "Link de afiliado";
  const label = `Preço caiu ${percent}%: ${offer.productTitle}, de ${formatBRL(from)} por ${formatBRL(offer.currentPrice)} na ${offer.merchant}. ${disclosure}. ${offer.cta ?? "Conferir preço"}.`;
  return (
    <OfferLink
      href={offer.href}
      ariaLabel={label}
      component="price_drop_v1"
      className="op-offer op-boxed op-drop"
      checkedAt={offer.checkedAt}
      expiresAt={expiresAt}
      estado={estado}
    >
      <span className="op-head">
        <span className="op-eyebrow">
          <span className="op-drop__label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M8 3v10M4 9l4 4 4-4" />
            </svg>
            Preço caiu {percent}%
          </span>
          <span className="op-sep" aria-hidden="true" />
          <span className="op-drop__since">
            <b className="op-brand">OpaPreço</b> registrou a queda{since ? ` ${since}` : ""}
          </span>
        </span>
        <span className="op-badge">{disclosure}</span>
      </span>
      <span className="op-drop__row">
        <OfferImage offer={offer} sizes="(max-width: 430px) 100vw, 240px" />
        <span className="op-drop__body">
          <span className="op-title op-clamp-2">{offer.productTitle}</span>
          <span className="op-drop__prices">
            <span>
              de <s>{formatBRL(from)}</s>
            </span>
            <span>
              por <span className="op-price">{formatBRL(offer.currentPrice)}</span>
            </span>
          </span>
          <span className="op-meta">
            <MetaLine offer={offer} servedAt={servedAt} />
          </span>
          <span className="op-cta op-cta--primary">
            <CtaLabel label={offer.cta ?? "Conferir preço"} />
          </span>
        </span>
      </span>
    </OfferLink>
  );
}
