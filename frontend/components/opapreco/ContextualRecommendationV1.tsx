import type { OfferData } from "@/lib/ads/types";
import { formatBRL } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, Discount, OfferImage, ariaLabelFor, metaLine } from "./parts";

/**
 * 5.6 — formato prioritário (article-inline-01). `<aside>` sem caixa, entre réguas, sem
 * padding lateral para alinhar com o texto. Só a linha de produto é clicável.
 */
export function ContextualRecommendationV1({
  offer,
  context,
  contextNote,
  servedAt,
  expiresAt,
  estado,
}: {
  offer: OfferData;
  context: string;
  contextNote?: string;
  servedAt: string;
  expiresAt?: string;
  estado?: EstadoForcado;
}) {
  const disclosure = offer.affiliateDisclosure ?? "Oferta afiliada";
  return (
    <aside aria-label={disclosure} data-ad-component="contextual_recommendation_v1" className="op-ctx">
      <span className="op-head">
        <span className="op-ctx__label">{disclosure}</span>
        <span className="op-eyebrow">
          <span>
            Selecionada pelo <b>OpaPreço</b>
          </span>
        </span>
      </span>
      <p className="op-ctx__heading">{context}</p>
      {contextNote && <p className="op-ctx__note">{contextNote}</p>}
      <OfferLink
        href={offer.href}
        ariaLabel={ariaLabelFor(offer, disclosure)}
        className="op-offer op-ctx__row"
        checkedAt={offer.checkedAt}
        expiresAt={expiresAt}
        estado={estado}
      >
        <span className="op-ctx__product">
          <OfferImage offer={offer} sizes="176px" icon={24} />
          <span className="op-ctx__info">
            <span className="op-title op-clamp-2">{offer.productTitle}</span>
            <span className="op-ctx__price">
              <span className="op-price">{formatBRL(offer.currentPrice)}</span>
              <Discount offer={offer} />
            </span>
            <span className="op-meta">{metaLine(offer, servedAt, true)}</span>
          </span>
        </span>
        <span className="op-cta op-cta--primary">
          <CtaLabel label={offer.cta ?? `Ver oferta na ${offer.merchant}`} />
        </span>
      </OfferLink>
    </aside>
  );
}
