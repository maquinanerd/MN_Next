import { describe, expect, it } from "vitest";
import { CORPO_PADRAO, CORPO_PUBLI } from "@/lib/content/fixtures/corpos";
import type { Bloco } from "@/lib/content/types";
import { placeInlineSlots } from "./placement";

const p = (texto: string): Bloco => ({ tipo: "paragrafo", trechos: [{ tipo: "texto", texto }] });
const img: Bloco = { tipo: "imagem", largura: "larga", imagem: { url: "/x.jpg", alt: "x" } };

/** Número do parágrafo depois do qual cada posição entrou. */
function positions(blocos: Bloco[], layout: "padrao" | "overlay" | "oferta") {
  const map = placeInlineSlots(blocos, layout);
  const numero = new Map<number, number>();
  let n = 0;
  blocos.forEach((b, i) => b.tipo === "paragrafo" && numero.set(i, ++n));
  return Object.fromEntries([...map].map(([i, slot]) => [slot, numero.get(i)]));
}

describe("posição dos anúncios no corpo", () => {
  it("reproduz o protótipo da matéria padrão", () => {
    const blocos = CORPO_PADRAO.filter((b): b is Bloco => !b.tipo.startsWith("@"));
    expect(positions(blocos, "padrao")).toEqual({
      "article-inline-01": 2,
      "article-inline-02": 3,
      "article-drop": 5,
      "article-inline-03": 6,
    });
  });

  it("na matéria de oferta, contextual antes do 2º subtítulo e dois cards", () => {
    const blocos = CORPO_PUBLI.filter((b): b is Bloco => !b.tipo.startsWith("@"));
    const pos = positions(blocos, "oferta");
    expect(pos["article-inline-01"]).toBe(2);
    expect(Object.keys(pos)).toEqual(["article-inline-01", "article-inline-02", "article-inline-03"]);
  });

  it("nunca logo após imagem nem no fim", () => {
    const blocos = [p("1"), p("2"), p("3"), img, p("4"), p("5")];
    const map = placeInlineSlots(blocos, "padrao");
    for (const i of map.keys()) {
      expect(blocos[i]!.tipo).toBe("paragrafo");
      if (i !== 1) expect(["paragrafo", "subtitulo"]).toContain(blocos[i + 1]!.tipo);
    }
    expect([...map.keys()]).not.toContain(5);
  });

  it("texto curto: só o que cabe", () => {
    expect(placeInlineSlots([p("1")], "padrao").size).toBe(0);
    expect(Object.keys(positions([p("1"), p("2")], "padrao"))).toEqual([]);
    expect(Object.keys(positions([p("1"), p("2"), p("3")], "padrao"))).toEqual(["article-inline-01"]);
  });
});
