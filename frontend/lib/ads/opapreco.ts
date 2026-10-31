import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adServerUrl, adsSource } from "../mode";
import { SITE } from "../site";
import { fixtureResponse } from "./fixtures";
import { resolveResponse } from "./rules";
import { SLOTS, type SlotContext, type SlotId } from "./slots";
import type { AdResult } from "./types";

/** Prazo do ad server (spec §14): passou disso, o slot é tratado como vazio. */
export const TIMEOUT_MS = 1500;

/** Log interno de slot vazio por erro: sem dado de leitor, só posição e motivo. */
function logEmpty(slot: SlotId, reason: string): void {
  console.warn(JSON.stringify({ evt: "opapreco_slot_vazio", slot, reason }));
}

async function fetchLive(base: URL, slot: SlotId, ctx: SlotContext, now: () => number): Promise<AdResult> {
  const url = new URL("/v1/ad", base);
  url.searchParams.set("publisher", process.env.OPAPRECO_PUBLISHER ?? "maquinanerd");
  url.searchParams.set("slot", SLOTS[slot].server);
  url.searchParams.set("placement", slot);
  url.searchParams.set("url", new URL(ctx.path, SITE.url).toString());
  url.searchParams.set("viewport", ctx.viewport ?? "desktop");
  if (ctx.containerWidth) url.searchParams.set("containerWidth", String(ctx.containerWidth));
  if (ctx.editoria) url.searchParams.set("editoria", ctx.editoria);
  if (ctx.tags?.length) url.searchParams.set("tags", ctx.tags.join(","));
  if (ctx.index) url.searchParams.set("index", String(ctx.index));
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 204) return { status: 204 };
    if (!res.ok) {
      logEmpty(slot, `http_${res.status}`);
      return { status: 204 };
    }
    const result = resolveResponse(await res.json(), now());
    if (result.status === 204) logEmpty(slot, "fora_do_contrato_ou_regras");
    return result;
  } catch (error) {
    logEmpty(slot, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "erro_de_rede");
    return { status: 204 };
  }
}

/**
 * No máximo um price_drop_v1 por página (spec §6): só a posição article-drop o exibe; nas
 * outras, a mesma oferta vira product_card_v1.
 */
function umaQuedaPorPagina(slot: SlotId, result: AdResult): AdResult {
  if (result.status !== 200 || result.render.component !== "price_drop_v1" || slot === "article-drop") return result;
  return { ...result, render: { component: "product_card_v1", offer: result.render.offer } };
}

/**
 * Pede ao ad server o anúncio de uma posição e devolve o resultado já filtrado pelas
 * regras (lib/ads/rules.ts). Erro, timeout de 1,5 s, corpo fora do contrato ou 204 viram
 * `{ status: 204 }`: o slot colapsa sem mensagem.
 *
 * A resposta fica em cache por alguns minutos por posição e contexto (o anúncio é
 * contextual, não pessoal), o que mantém as páginas estáticas. A impressão é contada e o
 * "verificado há X min" é recalculado no navegador.
 */
export async function fetchSlot(slot: SlotId, ctx: SlotContext): Promise<AdResult> {
  "use cache";
  // Revalida a cada minuto e nunca serve uma resposta com mais de 15 min: o rótulo
  // "verificado há X min" é recalculado no navegador, mas o anúncio em si não envelhece muito.
  // `stale` fica em 5 min de propósito: abaixo disso o Next 16 tira o slot do HTML estático
  // (vira esqueleto + streaming) e a troca empurra o layout.
  cacheLife({ stale: 300, revalidate: 60, expire: 900 });
  cacheTag("opapreco", `opapreco:${slot}`);
  const source = adsSource();
  if (source === "off") {
    if (process.env.OPAPRECO_AD_SERVER_URL && !adServerUrl()) logEmpty(slot, "url_do_ad_server_invalida");
    return { status: 204 };
  }
  if (source === "fixtures") {
    const now = Date.now();
    const raw = fixtureResponse(slot, ctx, now);
    if (raw === null) return { status: 204 };
    const result = umaQuedaPorPagina(slot, resolveResponse(raw, now));
    // Demonstração não conta impressão.
    return result.status === 200 ? { ...result, impressionUrl: undefined } : result;
  }
  return umaQuedaPorPagina(slot, await fetchLive(adServerUrl()!, slot, ctx, () => Date.now()));
}
