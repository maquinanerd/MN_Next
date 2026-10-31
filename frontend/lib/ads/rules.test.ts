import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/fixtures-offers.json";
import {
  checkedLabel,
  discountLabel,
  formatBRL,
  hasDiscount,
  hasValidPriceDrop,
  resolveResponse,
} from "./rules";

const NOW = Date.parse("2026-10-30T15:00:00-03:00");

type RawOffer = Record<string, unknown> & { checkedMinutesAgo?: number };

/** A fixture traz minutos relativos; o teste os converte em `checkedAt` (ver _note). */
function offer(raw: RawOffer): Record<string, unknown> {
  const { checkedMinutesAgo, ...rest } = raw;
  return { ...rest, checkedAt: new Date(NOW - (checkedMinutesAgo ?? 0) * 60_000).toISOString() };
}

function response(component: string, props: Record<string, unknown>) {
  return {
    requestId: "teste",
    slot: "article-inline-01",
    component,
    props,
    tracking: { impressionUrl: "https://example.com/imp" },
  };
}

const card = (o: RawOffer) => resolveResponse(response("product_card_v1", { offer: offer(o) }), NOW);

describe("ofertas servíveis", () => {
  it.each(Object.entries(fixtures.offers))("%s renderiza", (_name, o) => {
    expect(card(o as RawOffer).status).toBe(200);
  });

  it("price_drop_v1 com queda comprovada renderiza", () => {
    const r = resolveResponse(response("price_drop_v1", { offer: offer(fixtures.offers.priceDrop) }), NOW);
    expect(r.status).toBe(200);
  });

  it("price_drop_v1 sem priceDrop não renderiza", () => {
    const r = resolveResponse(response("price_drop_v1", { offer: offer(fixtures.offers.withDiscount) }), NOW);
    expect(r.status).toBe(204);
  });
});

describe("mustNotRender → 204", () => {
  const { _note: _ignored, ...cases } = fixtures.mustNotRender;
  it.each(Object.entries(cases))("%s colapsa como card", (_name, o) => {
    expect(card(o as RawOffer).status).toBe(204);
  });

  it("fakeDrop colapsa como price_drop_v1", () => {
    const r = resolveResponse(response("price_drop_v1", { offer: offer(fixtures.mustNotRender.fakeDrop) }), NOW);
    expect(r.status).toBe(204);
  });

  it("oferta verificada há mais de 6 h não é servida", () => {
    expect(card({ ...fixtures.offers.noDiscount, checkedMinutesAgo: 6 * 60 + 1 }).status).toBe(204);
    expect(card({ ...fixtures.offers.noDiscount, checkedMinutesAgo: 6 * 60 }).status).toBe(200);
  });

  it("corpo fora do contrato conta como vazio", () => {
    expect(resolveResponse({ component: "banner_728x90" }, NOW).status).toBe(204);
    expect(resolveResponse(null, NOW).status).toBe(204);
  });
});

describe("mustHideDiscount → só o preço atual", () => {
  const { _note: _ignored, ...cases } = fixtures.mustHideDiscount;
  it.each(Object.entries(cases))("%s", (_name, o) => {
    const r = card(o as RawOffer);
    expect(r.status).toBe(200);
    if (r.status !== 200 || r.render.component === "product_grid_v1") throw new Error("esperava oferta única");
    expect(r.render.offer.referencePrice).toBeUndefined();
    expect(r.render.offer.discountPercent).toBeUndefined();
    expect(r.render.offer.currentPrice).toBe((o as RawOffer).currentPrice);
  });

  it("desconto comprovado é mantido", () => {
    const r = card(fixtures.offers.withDiscount);
    if (r.status !== 200 || r.render.component === "product_grid_v1") throw new Error("esperava oferta única");
    expect(r.render.offer.discountPercent).toBe(21);
  });
});

describe("product_grid_v1", () => {
  const ids = fixtures.slots.grid.props.offers as (keyof typeof fixtures.offers)[];
  const offers = ids.map((k) => offer(fixtures.offers[k]));

  it("renderiza as 4 ofertas do slot de exemplo", () => {
    const r = resolveResponse(response("product_grid_v1", { heading: "Ofertas para o seu PS5", offers }), NOW);
    expect(r.status === 200 && r.render.component === "product_grid_v1" && r.render.offers.length).toBe(4);
  });

  it("menos de 2 ofertas servíveis → 204", () => {
    const stale = offer(fixtures.mustNotRender.stale);
    const r = resolveResponse(response("product_grid_v1", { offers: [offers[0], stale] }), NOW);
    expect(r.status).toBe(204);
  });
});

describe("formatação", () => {
  it("preço em BRL", () => {
    expect(formatBRL(299.9).replace(/ /g, " ")).toBe("R$ 299,90");
    expect(formatBRL(3299).replace(/ /g, " ")).toBe("R$ 3.299,00");
  });

  it("desconto usa o sinal de menos U+2212", () => {
    expect(discountLabel(17)).toBe("−17%");
    expect(discountLabel(17)).not.toContain("-");
  });

  it("verificação: agora, minutos e horas; acima de 6 h, nada", () => {
    const at = (min: number) => new Date(NOW - min * 60_000).toISOString();
    expect(checkedLabel(at(0), NOW)).toBe("Preço verificado agora");
    expect(checkedLabel(at(12), NOW)).toBe("Preço verificado há 12 min");
    expect(checkedLabel(at(185), NOW)).toBe("Preço verificado há 3 h");
    expect(checkedLabel(at(361), NOW)).toBeNull();
  });

  it("regras isoladas", () => {
    expect(hasDiscount({ currentPrice: 97, referencePrice: 100, discountPercent: 3 })).toBe(false);
    expect(hasDiscount({ currentPrice: 120, referencePrice: 100, discountPercent: 20 })).toBe(false);
    expect(hasDiscount({ currentPrice: 80, referencePrice: 100, discountPercent: 20 })).toBe(true);
    expect(hasValidPriceDrop({ currentPrice: 100, priceDrop: { from: 102, percent: 2 } })).toBe(false);
    expect(hasValidPriceDrop({ currentPrice: 329.9, priceDrop: { from: 399.9, percent: 18 } })).toBe(true);
  });
});

describe("achados da revisão", () => {
  const base = offer(fixtures.offers.noDiscount as RawOffer);
  const single = (o: Record<string, unknown>, component = "product_card_v1") =>
    resolveResponse(response(component, { offer: o }), NOW);
  const render = (r: ReturnType<typeof single>) => {
    if (r.status !== 200 || r.render.component === "product_grid_v1") throw new Error("esperava oferta única");
    return r.render.offer;
  };

  it("percentual que os preços não sustentam não vira desconto", () => {
    const o = render(single({ ...base, currentPrice: 97, referencePrice: 100, discountPercent: 40 }));
    expect(o.discountPercent).toBeUndefined();
  });

  it("queda com percentual inflado não renderiza", () => {
    const r = single({ ...base, currentPrice: 100, priceDrop: { from: 102, percent: 18 } }, "price_drop_v1");
    expect(r.status).toBe(204);
  });

  it("selo sem prova vira 'Oferta verificada'", () => {
    expect(render(single({ ...base, eyebrow: "Menor preço recente" })).eyebrow).toBe("Oferta verificada");
    expect(render(single({ ...base, eyebrow: "Boa oportunidade" })).eyebrow).toBe("Oferta verificada");
    const hero = offer(fixtures.offers.hero as RawOffer);
    expect(render(single({ ...hero, eyebrow: "Menor preço recente" })).eyebrow).toBe("Menor preço recente");
  });

  it("link afiliado precisa ser https", () => {
    expect(single({ ...base, href: "http://example.com/aff/x" }).status).toBe(204);
    expect(single({ ...base, href: "data:text/html,oi" }).status).toBe(204);
  });

  it("grade: oferta fora do contrato sai sozinha e 3 viram 2", () => {
    const ok = ["withDiscount", "noDiscount", "verticalImage"].map((k) => offer(fixtures.offers[k as keyof typeof fixtures.offers] as RawOffer));
    const r = resolveResponse(response("product_grid_v1", { offers: [...ok, { lixo: true }] }), NOW);
    expect(r.status === 200 && r.render.component === "product_grid_v1" && r.render.offers.length).toBe(2);
  });
});
