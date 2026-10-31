import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adsSource } from "../mode";
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

async function fetchLive(base: string, slot: SlotId, ctx: SlotContext, now: () => number): Promise<AdResult> {
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
 * Pede ao ad server o anúncio de uma posição e devolve o resultado já filtrado pelas
 * regras (lib/ads/rules.ts). Erro, timeout de 1,5 s, corpo fora do contrato ou 204 viram
 * `{ status: 204 }`: o slot colapsa sem mensagem.
 *
 * A resposta fica em cache por alguns minutos por posição e contexto (o anúncio é
 * contextual, não pessoal), o que mantém as páginas estáticas e o "verificado há X min"
 * coerente com o instante em que foi montado. A impressão é contada no cliente.
 */
export async function fetchSlot(slot: SlotId, ctx: SlotContext): Promise<AdResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("opapreco", `opapreco:${slot}`);
  const source = adsSource();
  if (source === "off") return { status: 204 };
  if (source === "fixtures") {
    const now = Date.now();
    const raw = fixtureResponse(slot, ctx, now);
    if (raw === null) return { status: 204 };
    const result = resolveResponse(raw, now);
    // Demonstração não conta impressão.
    return result.status === 200 ? { ...result, impressionUrl: undefined } : result;
  }
  return fetchLive(process.env.OPAPRECO_AD_SERVER_URL!, slot, ctx, () => Date.now());
}
