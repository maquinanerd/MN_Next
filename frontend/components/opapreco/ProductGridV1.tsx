import type { CSSProperties } from "react";
import type { OfferData } from "@/lib/ads/types";
import { formatBRL } from "@/lib/ads/rules";
import { OfferLink, type EstadoForcado } from "./OfferLink";
import { CtaLabel, Discount, OfferImage, ariaLabelFor } from "./parts";

function footLine(offers: OfferData[], servedAt: string): string {
  const now = Date.parse(servedAt);
  const oldest = Math.max(...offers.map((o) => Math.max(0, Math.floor((now - Date.parse(o.checkedAt)) / 60_000))));
  const merchant = offers[0]?.merchant ?? "Shopee";
  if (oldest < 1) return `Preços na ${merchant}, verificados agora.`;
  if (oldest < 60) return `Preços na ${merchant}, verificados há até ${oldest} min.`;
  return `Preços na ${merchant}, verificados há até ${Math.floor(oldest / 60)} h.`;
}

/**
 * 5.4 — faixa de ofertas (2 a 4; menos de 2 não renderiza). `<section>` + `<ul>`, um tab
 * stop por oferta, CTA secundário alinhado no rodapé de cada coluna.
 *
 * Ajustes do publisher (docs/05): o `gap` vem do site e, com `alinharAoSite`, as colunas
 * coincidem com as da grade de notícias (4, ou 2 que ocupam duas colunas cada); imagem
 * quadrada de até 280px.
 */
export function ProductGridV1({
  offers,
  heading = "Ofertas relacionadas",
  servedAt,
  expiresAt,
  gap,
  alinharAoSite = false,
  maxItems = 4,
  affiliateDisclosure = "Links de afiliado",
  estado,
}: {
  offers: OfferData[];
  heading?: string;
  servedAt: string;
  expiresAt?: string;
  gap?: string;
  alinharAoSite?: boolean;
  maxItems?: 2 | 3 | 4;
  affiliateDisclosure?: string;
  estado?: EstadoForcado;
}) {
  const list = offers.filter((o) => o.productTitle).slice(0, maxItems);
  if (list.length < 2) return null;
  const style = gap ? ({ "--op-grid-gap": gap } as CSSProperties) : undefined;
  return (
    <section
      aria-label={`${heading}. ${affiliateDisclosure}`}
      data-ad-component="product_grid_v1"
      className={`op-grid${alinharAoSite ? " op-grid--site" : ""}`}
      style={style}
    >
      <div className="op-grid__head">
        <h2 className="op-grid__heading">{heading}</h2>
        <span className="op-grid__disclosure">
          <b className="op-brand">OpaPreço</b> · {affiliateDisclosure}
        </span>
      </div>
      <ul className="op-grid__list">
        {list.map((o) => (
          <li key={o.offerId}>
            <OfferLink
              href={o.href}
              ariaLabel={ariaLabelFor(o, affiliateDisclosure)}
              className="op-offer op-boxed op-grid__item"
              checkedAt={o.checkedAt}
              expiresAt={expiresAt}
              estado={estado}
            >
              <OfferImage offer={o} sizes="(max-width: 760px) 50vw, 300px" icon={26} />
              <span className="op-title op-clamp-2">{o.productTitle}</span>
              <span className="op-grid__price">
                <span className="op-price">{formatBRL(o.currentPrice)}</span>
                <Discount offer={o} withReference={false} />
              </span>
              <span className="op-cta op-cta--secondary">
                <CtaLabel label={o.ctaShort ?? "Ver oferta"} arrow={false} />
              </span>
            </OfferLink>
          </li>
        ))}
      </ul>
      <span className="op-grid__foot">{footLine(list, servedAt)}</span>
    </section>
  );
}
