import type { OfferData } from "@/lib/ads/types";
import { formatBRL } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, Discount, OfferImage, ariaLabelFor } from "./parts";

/**
 * 5.2 — entre parágrafos, 88px fixos, sempre uma linha. Implementado conforme a spec, mas
 * o Máquina Nerd não o usa (o publisher pediu formatos maiores; docs/05).
 */
export function ProductCompactV1({
  offer,
  expiresAt,
  estado,
}: {
  offer: OfferData;
  servedAt?: string;
  expiresAt?: string;
  estado?: EstadoForcado;
}) {
  const disclosure = offer.affiliateDisclosure ?? "Oferta afiliada";
  return (
    <OfferLink
      href={offer.href}
      ariaLabel={ariaLabelFor(offer, disclosure)}
      component="product_compact_v1"
      className="op-offer op-boxed op-compact"
      checkedAt={offer.checkedAt}
      expiresAt={expiresAt}
      estado={estado}
    >
      <OfferImage offer={offer} sizes="112px" icon={22} />
      <span className="op-compact__body">
        <span className="op-compact__disclosure">
          {disclosure} · {offer.merchant}
        </span>
        <span className="op-title">{offer.productTitle}</span>
        <span className="op-compact__price">
          <span className="op-price">{formatBRL(offer.currentPrice)}</span>
          <Discount offer={offer} withReference={false} />
        </span>
      </span>
      <span className="op-cta op-cta--secondary">
        <CtaLabel label={offer.ctaShort ?? "Ver oferta"} arrow={false} />
      </span>
    </OfferLink>
  );
}
