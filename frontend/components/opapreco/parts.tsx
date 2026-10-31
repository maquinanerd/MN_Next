import Image from "next/image";
import type { OfferData } from "@/lib/ads/types";
import { checkedLabel, discountLabel, formatBRL, hasDiscount, isLowest30d } from "@/lib/ads/rules";
import { Verificado } from "./Verificado";

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

/**
 * Preço de referência riscado + selo de desconto, só com prova (sinal duplo, nunca só cor).
 * Para leitor de tela, o desconto entra no nome acessível do link (`ariaLabelFor`): um
 * aria-label aqui dentro não seria lido e é proibido em elemento genérico.
 */
export function Discount({ offer, withReference = true }: { offer: OfferData; withReference?: boolean }) {
  if (!hasDiscount(offer)) return null;
  return (
    <>
      {withReference && (
        <s className="op-ref">{formatBRL(offer.referencePrice!)}</s>
      )}
      <span className="op-disc">{discountLabel(offer.discountPercent!)}</span>
    </>
  );
}

/**
 * Nome acessível da oferta (spec §5 e §10): "{título} por {preço} na Shopee. Link de
 * afiliado." Com desconto comprovado, "por R$ 549,90 (de R$ 699,90, 21% de desconto)"; com
 * `menor30d`, o menor preço dos últimos 30 dias. O texto do CTA visível vai no fim, para
 * quem aciona o link por comando de voz (WCAG 2.5.3).
 */
export function ariaLabelFor(
  offer: OfferData,
  disclosure: string,
  cta?: string,
  { menor30d = false }: { menor30d?: boolean } = {},
): string {
  const extras = [
    hasDiscount(offer) ? `de ${formatBRL(offer.referencePrice!)}, ${offer.discountPercent}% de desconto` : null,
    menor30d && isLowest30d(offer) ? "menor preço dos últimos 30 dias" : null,
  ].filter(Boolean);
  const preco = `${formatBRL(offer.currentPrice)}${extras.length ? ` (${extras.join("; ")})` : ""}`;
  const base = `${offer.productTitle} por ${preco} na ${offer.merchant}. ${disclosure}.`;
  return cta ? `${base} ${cta}.` : base;
}

/** "Shopee · Preço verificado há 12 min", com a verificação recalculada no navegador. */
export function MetaLine({ offer, servedAt, lower = false }: { offer: OfferData; servedAt: string; lower?: boolean }) {
  const checked = checkedLabel(offer.checkedAt, Date.parse(servedAt), lower);
  if (!checked) return <>{offer.merchant}</>;
  return (
    <>
      {offer.merchant} · <Verificado checkedAt={offer.checkedAt} inicial={checked} minusculo={lower} />
    </>
  );
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
