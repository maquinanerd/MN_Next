import type { OfferData } from "@/lib/ads/types";
import { checkedLabel, eyebrowFor, formatBRL, isLowest30d } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, Discount, OfferHead, OfferImage, ariaLabelFor } from "./parts";
import { Verificado } from "./Verificado";

/** 5.3 — topo da matéria (desktop/tablet). Vertical abaixo de 600px de contêiner. */
export function ProductHeroV1({
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
  const checked = checkedLabel(offer.checkedAt, Date.parse(servedAt));
  const resto = [
    isLowest30d(offer) ? "menor preço dos últimos 30 dias" : null,
    `${offer.isOfficialStore ? "loja oficial na " : ""}${offer.merchant}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <OfferLink
      href={offer.href}
      ariaLabel={ariaLabelFor(offer, disclosure, offer.cta ?? `Ver oferta na ${offer.merchant}`, {
        menor30d: true,
      })}
      component="product_hero_v1"
      className="op-offer op-boxed op-hero"
      checkedAt={offer.checkedAt}
      expiresAt={expiresAt}
      estado={estado}
    >
      <OfferImage offer={offer} sizes="(max-width: 600px) 100vw, 600px" eager icon={40} />
      <span className="op-hero__body">
        <OfferHead eyebrow={eyebrowFor(offer)} disclosure={disclosure} />
        <span className="op-title op-clamp-3">{offer.productTitle}</span>
        <span className="op-hero__prices">
          {offer.referencePrice !== undefined && (
            <span className="op-hero__ref">
              <Discount offer={offer} />
            </span>
          )}
          <span className="op-price">{formatBRL(offer.currentPrice)}</span>
        </span>
        <span className="op-monitor">
          <span className="op-monitor__title">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#0B6E4F"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M2 12l4-4 3 3 5-6" />
            </svg>
            Preço monitorado pelo OpaPreço
          </span>
          <span>
            {checked ? (
              <>
                <Verificado checkedAt={offer.checkedAt} inicial={checked} /> · {resto}
              </>
            ) : (
              resto.charAt(0).toUpperCase() + resto.slice(1)
            )}
          </span>
        </span>
        <span className="op-cta op-cta--primary">
          <CtaLabel label={offer.cta ?? `Ver oferta na ${offer.merchant}`} />
        </span>
      </span>
    </OfferLink>
  );
}
