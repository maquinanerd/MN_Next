import type { Bloco, Layout } from "@/lib/content/types";
import type { SlotId } from "./slots";

/**
 * Onde entram os anúncios dentro do corpo da matéria (docs/05 e protótipos):
 *  - article-inline-01 (contextual) logo após o 2º parágrafo;
 *  - os demais, em ordem, depois do primeiro parágrafo "candidato" seguinte ao anterior:
 *    um parágrafo seguido de outro parágrafo ou de um subtítulo. Assim o anúncio fica
 *    sempre entre dois blocos de texto — nunca logo após uma imagem, nunca colado num
 *    divisor de seção, nunca no fim.
 * Padrão e overlay: card, queda de preço (ou card) e card. Oferta: dois cards.
 * Devolve índice do bloco → posição.
 */
export function placeInlineSlots(blocos: Bloco[], layout: Layout): Map<number, SlotId> {
  const out = new Map<number, SlotId>();
  const sequencia: SlotId[] =
    layout === "oferta"
      ? ["article-inline-02", "article-inline-03"]
      : ["article-inline-02", "article-drop", "article-inline-03"];

  let n = 0;
  const paragrafos: { index: number; numero: number; candidato: boolean }[] = [];
  blocos.forEach((b, index) => {
    if (b.tipo !== "paragrafo") return;
    n += 1;
    const next = blocos[index + 1];
    paragrafos.push({
      index,
      numero: n,
      candidato: !!next && (next.tipo === "paragrafo" || next.tipo === "subtitulo"),
    });
  });

  // O contextual precisa de texto depois dele: com o 2º parágrafo no fim, não entra.
  const segundo = paragrafos.find((p) => p.numero === 2);
  if (!segundo || !blocos[segundo.index + 1]) return out;
  out.set(segundo.index, "article-inline-01");

  let ultimo = 2;
  for (const slot of sequencia) {
    const alvo = paragrafos.find((p) => p.numero > ultimo && p.candidato);
    if (!alvo) break;
    out.set(alvo.index, slot);
    ultimo = alvo.numero;
  }
  return out;
}
