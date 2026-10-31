import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDemo } from "@/lib/mode";
import { cacheLife } from "next/cache";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ContextualRecommendationV1 } from "@/components/opapreco/ContextualRecommendationV1";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import type { EstadoForcado } from "@/components/opapreco/OfferLink";
import { PriceDropV1 } from "@/components/opapreco/PriceDropV1";
import { ProductCardV1 } from "@/components/opapreco/ProductCardV1";
import { ProductCompactV1 } from "@/components/opapreco/ProductCompactV1";
import { ProductGridV1 } from "@/components/opapreco/ProductGridV1";
import { ProductHeroV1 } from "@/components/opapreco/ProductHeroV1";
import { Skeleton } from "@/components/opapreco/Skeletons";
import fixtures from "@/lib/ads/fixtures/fixtures-offers.json";
import { resolveResponse } from "@/lib/ads/rules";
import type { AdResult, OfferData } from "@/lib/ads/types";

export const metadata: Metadata = {
  title: "OpaPreço Ads — vitrine",
  robots: { index: false, follow: false },
};

type Raw = Record<string, unknown> & { checkedMinutesAgo?: number };

/** Passa cada caso de fixtures-offers.json pelo mesmo caminho do ad server real (contrato + regras). */
async function vitrine() {
  "use cache";
  cacheLife("minutes");
  const now = Date.now();
  const servedAt = new Date(now).toISOString();
  const toOffer = (raw: Raw) => {
    const { checkedMinutesAgo, ...rest } = raw;
    return { ...rest, checkedAt: new Date(now - (checkedMinutesAgo ?? 0) * 60_000).toISOString() };
  };
  const resolve = (component: string, props: Record<string, unknown>): AdResult =>
    resolveResponse(
      { requestId: "vitrine", slot: "article-inline-02", component, props, tracking: { impressionUrl: "https://example.com/i" } },
      now,
    );
  const single = (raw: Raw, component = "product_card_v1") => resolve(component, { offer: toOffer(raw) });
  const offerOf = (r: AdResult): OfferData | null =>
    r.status === 200 && r.render.component !== "product_grid_v1" ? r.render.offer : null;

  const o = fixtures.offers;
  const casos = Object.entries(o).map(([nome, raw]) => ({ nome, offer: offerOf(single(raw as Raw)) }));
  const ocultaDesconto = Object.entries(fixtures.mustHideDiscount)
    .filter(([k]) => k !== "_note")
    .map(([nome, raw]) => ({ nome, offer: offerOf(single(raw as Raw)) }));
  const naoRenderiza = Object.entries(fixtures.mustNotRender)
    .filter(([k]) => k !== "_note")
    .map(([nome, raw]) => ({ nome, status: single(raw as Raw).status }));
  const grid = resolve("product_grid_v1", {
    heading: fixtures.slots.grid.props.heading,
    offers: (fixtures.slots.grid.props.offers as (keyof typeof o)[]).map((k) => toOffer(o[k] as Raw)),
  });
  return {
    servedAt,
    casos,
    ocultaDesconto,
    naoRenderiza,
    card: offerOf(single(o.withDiscount as Raw))!,
    hero: offerOf(single(o.hero as Raw, "product_hero_v1"))!,
    drop: offerOf(single(o.priceDrop as Raw, "price_drop_v1"))!,
    ctx: offerOf(
      resolve("contextual_recommendation_v1", {
        offer: toOffer(o.withDiscount as Raw),
        context: fixtures.slots.contextual.props.context,
        contextNote: fixtures.slots.contextual.props.contextNote,
      }),
    )!,
    compact: offerOf(single(o.noDiscount as Raw, "product_compact_v1"))!,
    gridOffers: grid.status === 200 && grid.render.component === "product_grid_v1" ? grid.render.offers : [],
    ctxTexto: fixtures.slots.contextual.props,
  };
}

const ESTADOS: (EstadoForcado | "default")[] = ["default", "hover", "focus", "active", "disabled"];

function Secao({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t border-mn-line pt-10">
      <h2 className="m-0 font-mono text-[13px] font-normal">{titulo}</h2>
      {nota && <p className="mt-1.5 mb-0 max-w-[720px] text-xs leading-normal text-mn-muted">{nota}</p>}
      <div className="mt-6 flex flex-col gap-8">{children}</div>
    </section>
  );
}

function Quadro({ rotulo, largura, children }: { rotulo: string; largura: number; children: ReactNode }) {
  return (
    <div className="w-full" style={{ maxWidth: largura }}>
      <p className="m-0 mb-2 font-mono text-[11px] text-mn-muted">{rotulo}</p>
      <div className="op-slot">{children}</div>
    </div>
  );
}

function Larguras({ children }: { children: (largura: number) => ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-8">
      {[720, 343].map((w) => (
        <Quadro key={w} rotulo={`contêiner de ${w}px`} largura={w}>
          {children(w)}
        </Quadro>
      ))}
    </div>
  );
}

export default async function OpaPrecoPage() {
  // Vitrine interna: com CMS e ad server ligados, não existe em produção.
  if (!isDemo()) notFound();
  const v = await vitrine();
  const { servedAt } = v;
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mn-wrap pt-10 pb-16">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-.035em]">OpaPreço Ads — vitrine</h1>
        <p className="mt-2 mb-0 max-w-[720px] text-[13px] leading-normal text-mn-summary">
          Os seis componentes da spec em todos os estados e casos de dados de <code>fixtures-offers.json</code>, passando
          pelo mesmo contrato e pelas mesmas regras de preço do ad server real. Ofertas de demonstração.
        </p>

        <Secao titulo="product_card_v1 · estados" nota="Hover, foco e clique forçados por classe para a captura; no site vêm de :hover, :focus-visible e :active.">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,520px),1fr))] gap-6">
            {ESTADOS.map((e) => (
              <Quadro key={e} rotulo={e} largura={720}>
                <ProductCardV1 offer={v.card} servedAt={servedAt} estado={e === "default" ? undefined : e} />
              </Quadro>
            ))}
            <Quadro rotulo="loading" largura={720}>
              <Skeleton component="product_card_v1" />
            </Quadro>
            <Quadro rotulo="error / empty (204)" largura={720}>
              <p className="m-0 border-y border-dashed border-mn-line-3 py-2 text-center font-mono text-[11px] text-mn-muted">
                slot removido · height 0
              </p>
            </Quadro>
          </div>
        </Secao>

        <Secao titulo="product_card_v1 · casos de dados (offers)">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,520px),1fr))] gap-6">
            {v.casos.map(({ nome, offer }) => (
              <Quadro key={nome} rotulo={nome} largura={720}>
                {offer ? <ProductCardV1 offer={offer} servedAt={servedAt} /> : <p>204</p>}
              </Quadro>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            {v.casos.slice(0, 2).map(({ nome, offer }) => (
              <Quadro key={nome} rotulo={`${nome} · lateral de 300px (vertical)`} largura={300}>
                {offer && <ProductCardV1 offer={offer} servedAt={servedAt} />}
              </Quadro>
            ))}
            <Quadro rotulo="loading · lateral de 300px" largura={300}>
              <Skeleton component="product_card_v1" />
            </Quadro>
          </div>
        </Secao>

        <Secao
          titulo="mustHideDiscount → só o preço atual · mustNotRender → 204"
          nota="Desconto abaixo de 5% ou referência menor que o preço: a oferta aparece sem riscado e sem selo. Oferta vencida (> 6 h), sem título ou com queda falsa: o ad server responde 204 e o slot colapsa."
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,520px),1fr))] gap-6">
            {v.ocultaDesconto.map(({ nome, offer }) => (
              <Quadro key={nome} rotulo={nome} largura={720}>
                {offer && <ProductCardV1 offer={offer} servedAt={servedAt} />}
              </Quadro>
            ))}
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0 font-mono text-[11px]">
            {v.naoRenderiza.map(({ nome, status }) => (
              <li key={nome} className="border border-mn-line-3 px-2.5 py-1.5">
                {nome}: {status === 204 ? "204 · não renderiza" : `${status} · ERRO`}
              </li>
            ))}
          </ul>
        </Secao>

        <Secao titulo="product_hero_v1 · article-top (desktop/tablet)">
          <Larguras>{() => <ProductHeroV1 offer={v.hero} servedAt={servedAt} />}</Larguras>
          <Larguras>{() => <Skeleton component="product_hero_v1" />}</Larguras>
        </Secao>

        <Secao titulo="contextual_recommendation_v1 · article-inline-01">
          <Larguras>
            {() => (
              <ContextualRecommendationV1
                offer={v.ctx}
                context={v.ctxTexto.context}
                contextNote={v.ctxTexto.contextNote}
                servedAt={servedAt}
              />
            )}
          </Larguras>
          <Larguras>{() => <Skeleton component="contextual_recommendation_v1" />}</Larguras>
        </Secao>

        <Secao titulo="price_drop_v1 · queda comprovada">
          <Larguras>{() => <PriceDropV1 offer={v.drop} servedAt={servedAt} />}</Larguras>
          <Larguras>{() => <PriceDropV1 offer={v.drop} servedAt={servedAt} estado="hover" />}</Larguras>
          <Larguras>{() => <Skeleton component="price_drop_v1" />}</Larguras>
        </Secao>

        <Secao titulo="product_grid_v1 · article-bottom (gap padrão de 16px)">
          <Larguras>{() => <ProductGridV1 offers={v.gridOffers} heading="Ofertas para o seu PS5" servedAt={servedAt} />}</Larguras>
          <Larguras>{() => <Skeleton component="product_grid_v1" />}</Larguras>
        </Secao>

        <Secao
          titulo="product_grid_v1 · publisher (gap 40px, colunas da grade do site)"
          nota="A faixa abaixo usa o mesmo contêiner e o mesmo gap da grade de notícias de 4 colunas acima dela: as colunas coincidem (2 colunas de oferta quando não cabem 4)."
        >
          <div className="grid grid-cols-4 gap-10 mob:grid-cols-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 bg-mn-surface font-mono text-[11px] leading-10 text-mn-muted mob:hidden">
                &nbsp;coluna {n}
              </div>
            ))}
          </div>
          <OpaSlot id="home-grid-cinema" ctx={{ path: "/dev/opapreco" }} gap="var(--mn-grid-gap)" alinharAoSite />
        </Secao>

        <Secao titulo="product_compact_v1 · implementado, não usado no Máquina Nerd">
          <Larguras>{() => <ProductCompactV1 offer={v.compact} />}</Larguras>
          <Larguras>{() => <Skeleton component="product_compact_v1" />}</Larguras>
        </Secao>
      </main>
      <SiteFooter />
    </>
  );
}
