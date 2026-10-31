import "server-only";

/**
 * De onde vêm conteúdo e anúncios. Sem configuração, os dois vêm das fixtures de
 * demonstração — e a página se declara demonstração (faixa no topo e `noindex`).
 *
 *  - MN_CONTENT_SOURCE=cms        → adaptador do CMS (ainda não ligado; ver lib/content/adapter.ts)
 *  - OPAPRECO_AD_SERVER_URL=https://… → ad server real do OpaPreço (lib/ads/opapreco.ts)
 *  - OPAPRECO_MODE=off            → nenhum slot é montado (todas as posições colapsam)
 */
export type ContentSource = "fixtures" | "cms";
export type AdsSource = "fixtures" | "live" | "off";

export function contentSource(): ContentSource {
  return process.env.MN_CONTENT_SOURCE === "cms" ? "cms" : "fixtures";
}

/**
 * Endereço do ad server, só se for uma URL https válida. Configurado errado, os slots
 * colapsam (falha silenciosa da spec §1.6) em vez de derrubar a página.
 */
export function adServerUrl(): URL | null {
  const raw = process.env.OPAPRECO_AD_SERVER_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function adsSource(): AdsSource {
  if (process.env.OPAPRECO_MODE === "off") return "off";
  if (!process.env.OPAPRECO_AD_SERVER_URL) return "fixtures";
  return adServerUrl() ? "live" : "off";
}

export function isDemo(): boolean {
  return contentSource() === "fixtures" || adsSource() === "fixtures";
}
