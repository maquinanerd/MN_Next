import "server-only";
import type { ContentAdapter } from "./adapter";

/**
 * Ponto de ligação do CMS. Implementa `ContentAdapter` lendo o CMS, validando a resposta
 * em tempo de execução e mapeando para os tipos de `types.ts` (parágrafos viram `Trecho[]`,
 * nunca HTML cru). Enquanto não existir, ligar `MN_CONTENT_SOURCE=cms` falha de forma
 * visível no servidor — a página não cai em silêncio para as fixtures.
 */
export function cmsAdapter(): ContentAdapter {
  throw new Error(
    "MN_CONTENT_SOURCE=cms, mas o adaptador do CMS ainda não foi implementado (lib/content/cms.ts).",
  );
}
