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

export function adsSource(): AdsSource {
  if (process.env.OPAPRECO_MODE === "off") return "off";
  return process.env.OPAPRECO_AD_SERVER_URL ? "live" : "fixtures";
}

export function isDemo(): boolean {
  return contentSource() === "fixtures" || adsSource() === "fixtures";
}
