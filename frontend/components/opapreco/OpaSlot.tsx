import { Suspense } from "react";
import { fetchSlot } from "@/lib/ads/opapreco";
import { RESERVE, SLOTS, type SlotContext, type SlotId } from "@/lib/ads/slots";
import type { AdResult } from "@/lib/ads/types";
import { ContextualRecommendationV1 } from "./ContextualRecommendationV1";
import { PriceDropV1 } from "./PriceDropV1";
import { ProductCardV1 } from "./ProductCardV1";
import { ProductCompactV1 } from "./ProductCompactV1";
import { ProductGridV1 } from "./ProductGridV1";
import { ProductHeroV1 } from "./ProductHeroV1";
import { Skeleton } from "./Skeletons";
import { SlotView } from "./SlotView";

export interface OpaSlotProps {
  id: SlotId;
  ctx: SlotContext;
  /** Classes do publisher no invólucro (margens, visibilidade por largura). Somem com o slot. */
  className?: string;
  /** Gap da grade, vindo do site (docs/05: 40px na home e na editoria). */
  gap?: string;
  /** Colunas da grade coincidindo com as da grade de notícias. */
  alinharAoSite?: boolean;
  /** Reserva vertical (lateral de 300px) ou horizontal. */
  orientacao?: "wide" | "narrow";
}

/** Escolhe o componente devolvido pelo ad server. */
export function AdView({
  result,
  gap,
  alinharAoSite,
}: {
  result: Extract<AdResult, { status: 200 }>;
  gap?: string;
  alinharAoSite?: boolean;
}) {
  const { render, servedAt, expiresAt } = result;
  switch (render.component) {
    case "product_card_v1":
      return <ProductCardV1 offer={render.offer} servedAt={servedAt} expiresAt={expiresAt} />;
    case "product_compact_v1":
      return <ProductCompactV1 offer={render.offer} servedAt={servedAt} expiresAt={expiresAt} />;
    case "product_hero_v1":
      return <ProductHeroV1 offer={render.offer} servedAt={servedAt} expiresAt={expiresAt} />;
    case "price_drop_v1":
      return <PriceDropV1 offer={render.offer} servedAt={servedAt} expiresAt={expiresAt} />;
    case "contextual_recommendation_v1":
      return (
        <ContextualRecommendationV1
          offer={render.offer}
          context={render.context}
          contextNote={render.contextNote}
          servedAt={servedAt}
          expiresAt={expiresAt}
        />
      );
    case "product_grid_v1":
      return (
        <ProductGridV1
          offers={render.offers}
          heading={render.heading}
          servedAt={servedAt}
          expiresAt={expiresAt}
          gap={gap}
          alinharAoSite={alinharAoSite}
        />
      );
  }
}

function wrapperClass(id: SlotId, className?: string): string {
  return ["op-slot", SLOTS[id].sidebar ? "op-sidebar-only" : "", className ?? ""].filter(Boolean).join(" ");
}

async function ResolvedSlot({ id, ctx, className, gap, alinharAoSite }: OpaSlotProps) {
  const result = await fetchSlot(id, ctx);
  // 204, erro ou timeout resolvidos no servidor: o slot nem é montado (sem caixa, sem mensagem).
  if (result.status === 204) return null;
  return (
    <SlotView slot={id} className={wrapperClass(id, className)} impressionUrl={result.impressionUrl}>
      <AdView result={result} gap={gap} alinharAoSite={alinharAoSite} />
    </SlotView>
  );
}

/**
 * Posição OpaPreço (spec §14). Renderiza no servidor quando a resposta existe; enquanto
 * não existe, mostra o esqueleto com a mesma geometria e a altura reservada do componente
 * esperado. Vazio (204/erro/timeout de 1,5 s) colapsa: nada é montado.
 */
export function OpaSlot(props: OpaSlotProps) {
  const esperado = SLOTS[props.id].esperado;
  const reserve = RESERVE[esperado][props.orientacao ?? (SLOTS[props.id].sidebar ? "narrow" : "wide")];
  return (
    <Suspense
      fallback={
        <div
          data-op-slot={props.id}
          className={wrapperClass(props.id, props.className)}
          style={{ minHeight: reserve }}
        >
          <Skeleton component={esperado} alinharAoSite={props.alinharAoSite} />
        </div>
      }
    >
      <ResolvedSlot {...props} />
    </Suspense>
  );
}
