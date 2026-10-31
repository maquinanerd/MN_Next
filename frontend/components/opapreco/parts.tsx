import Image from "next/image";
import type { OfferData } from "@/lib/ads/types";
import { checkedLabel, discountLabel, formatBRL, hasDiscount } from "@/lib/ads/rules";

/** Quadro de imagem de produto: `contain` sobre #F7F7F7, nunca `cover`; sem imagem, ícone de etiqueta. */
export function OfferImage({
  offer,
  className = "",
  sizes,
  eager = false,
  icon = 28,
  merchantLabel = false,
}: {
  offer: OfferData;
  className?: string;
  sizes: string;
  eager?: boolean;
  icon?: number;
  merchantLabel?: boolean;
}) {
  return (
    <span className={`op-img ${className}`}>
      {offer.productImage ? (
        <Image
          src={offer.productImage}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <span className="op-noimg">
          <TagIcon size={icon} />
          {merchantLabel && <span>{offer.merchant}</span>}
        </span>
      )}
    </span>
  );
}

export function TagIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M5 11L11 5M6 5h5v5" />
    </svg>
  );
}

/** "OpaPreço | Oferta verificada" à esquerda, selo de afiliado à direita. */
export function OfferHead({ eyebrow, disclosure }: { eyebrow: string; disclosure: string }) {
  return (
    <span className="op-head">
      <span className="op-eyebrow">
        <b>OpaPreço</b>
        <span className="op-sep" aria-hidden="true" />
        <span>{eyebrow}</span>
      </span>
      <span className="op-badge">{disclosure}</span>
    </span>
  );
}

/** Preço de referência riscado + selo de desconto, só com prova (sinal duplo, nunca só cor). */
export function Discount({ offer, withReference = true }: { offer: OfferData; withReference?: boolean }) {
  if (!hasDiscount(offer)) return null;
  return (
    <>
      {withReference && (
        <s className="op-ref" aria-label={`Preço de referência ${formatBRL(offer.referencePrice!)}`}>
          {formatBRL(offer.referencePrice!)}
        </s>
      )}
      <span className="op-disc" aria-label={`${offer.discountPercent}% de desconto`}>
        {discountLabel(offer.discountPercent!)}
      </span>
    </>
  );
}

export function ariaLabelFor(offer: OfferData, disclosure: string): string {
  return `${offer.productTitle} por ${formatBRL(offer.currentPrice)} na ${offer.merchant}. ${disclosure}.`;
}

/** "Shopee · Preço verificado há 12 min" */
export function metaLine(offer: OfferData, servedAt: string, lower = false): string {
  const checked = checkedLabel(offer.checkedAt, Date.parse(servedAt), lower);
  return [offer.merchant, checked].filter(Boolean).join(" · ");
}

/** Texto do CTA com a alternativa do estado desabilitado. */
export function CtaLabel({ label, arrow = true }: { label: string; arrow?: boolean }) {
  return (
    <>
      <span className="op-on">{label}</span>
      <span className="op-off">Oferta indisponível</span>
      {arrow && <ArrowIcon />}
    </>
  );
}
