import type { OfferData } from "@/lib/ads/types";
import { eyebrowFor, formatBRL } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, Discount, OfferHead, OfferImage, ariaLabelFor, metaLine } from "./parts";

/** 5.1 — meio de artigo e laterais. Horizontal ≥ 480px de contêiner; vertical abaixo (sidebar de 300px). */
export function ProductCardV1({
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
  const disclosure = offer.affiliateDisclosure ?? "Link de afiliado";
  return (
    <OfferLink
      href={offer.href}
      ariaLabel={ariaLabelFor(offer, disclosure, offer.cta ?? `Ver oferta na ${offer.merchant}`)}
      component="product_card_v1"
      className="op-offer op-boxed op-card"
      checkedAt={offer.checkedAt}
      expiresAt={expiresAt}
      estado={estado}
    >
      <OfferImage offer={offer} sizes="(max-width: 480px) 100vw, 320px" merchantLabel />
      <span className="op-card__body">
        <OfferHead eyebrow={eyebrowFor(offer)} disclosure={disclosure} />
        <span className="op-title op-clamp-2">{offer.productTitle}</span>
        <span className="op-card__price">
          <span className="op-price">{formatBRL(offer.currentPrice)}</span>
          <Discount offer={offer} />
        </span>
        <span className="op-card__foot">
          <span className="op-meta">
            <span className="op-on">{metaLine(offer, servedAt)}</span>
            <span className="op-off">Preço deixou de ser válido</span>
          </span>
          <span className="op-cta op-cta--primary">
            <CtaLabel label={offer.cta ?? `Ver oferta na ${offer.merchant}`} />
          </span>
        </span>
      </span>
    </OfferLink>
  );
}
