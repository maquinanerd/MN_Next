import type { ReactNode } from "react";
import { placeInlineSlots } from "@/lib/ads/placement";
import type { SlotContext } from "@/lib/ads/slots";
import type { Bloco, Layout } from "@/lib/content/types";
import { FloatRelated, LeiaTambem, ProductCard } from "@/components/commerce/Commerce";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import { Citacao, RelatedInline, WideFigure } from "./ArticleParts";
import { Trechos } from "./Trechos";

/**
 * Corpo da matéria. Os blocos vêm tipados do adaptador; os divisores abrem uma nova seção
 * (filete + 32px), e os anúncios entram nas posições de `placeInlineSlots` — sempre entre
 * dois blocos de texto. Na matéria de oferta, a caixa "Relacionado" flutua ao lado do
 * primeiro parágrafo e os subtítulos ficam em vermelho.
 */
export function ArticleBody({
  blocos,
  layout,
  ctx,
  corCitacao,
}: {
  blocos: Bloco[];
  layout: Layout;
  ctx: SlotContext;
  corCitacao: string;
}) {
  const slots = placeInlineSlots(blocos, layout);
  const secoes: ReactNode[][] = [[]];
  let primeiroParagrafo = true;

  blocos.forEach((b, i) => {
    const atual = secoes[secoes.length - 1]!;
    const key = `b${i}`;
    switch (b.tipo) {
      case "divisor":
        secoes.push([]);
        return;
      case "paragrafo": {
        const p = (
          <p
            key={key}
            className={`mn-body ${primeiroParagrafo && secoes.length === 1 && !atual.length ? "mt-8" : ""}`}
          >
            <Trechos trechos={b.trechos} />
          </p>
        );
        // A caixa "Relacionado" flutua junto do parágrafo seguinte (display: flow-root).
        const prev = blocos[i - 1];
        if (prev?.tipo === "relacionado-flutuante") {
          atual.push(
            <div key={`${key}-float`} className="mt-8 flow-root">
              <FloatRelated item={prev.item} />
              <p className="mn-body">
                <Trechos trechos={b.trechos} />
              </p>
            </div>,
          );
        } else {
          atual.push(p);
        }
        primeiroParagrafo = false;
        break;
      }
      case "subtitulo":
        atual.push(
          <h2
            key={key}
            className="mt-9 mb-3.5 text-[22px] leading-[1.2] font-extrabold tracking-[-.025em]"
            style={layout === "oferta" ? { color: "#B00710" } : undefined}
          >
            {b.texto}
          </h2>,
        );
        break;
      case "imagem":
        atual.push(
          b.largura === "larga" ? (
            <WideFigure key={key} imagem={b.imagem} proporcao={b.proporcao} pb={b.pb} />
          ) : (
            <WideFigure
              key={key}
              imagem={b.imagem}
              proporcao={b.proporcao}
              pb={b.pb}
              className="mt-7 !mx-0 [&_figcaption]:!mx-0"
            />
          ),
        );
        break;
      case "citacao":
        atual.push(<Citacao key={key} texto={b.texto} autor={b.autor} cor={corCitacao} />);
        break;
      case "relacionadas-inline":
        atual.push(
          <RelatedInline
            key={key}
            itens={b.itens}
            imagem={b.imagem}
            maisHref={b.maisHref}
            maisRotulo={b.maisRotulo}
          />,
        );
        break;
      case "produto":
        atual.push(<ProductCard key={key} produto={b.produto} />);
        break;
      case "leia-tambem":
        atual.push(<LeiaTambem key={key} item={b.item} className="mt-6" />);
        break;
      case "relacionado-flutuante":
        // Renderizado junto do parágrafo seguinte.
        break;
    }
    const slot = slots.get(i);
    if (slot) atual.push(<OpaSlot key={`${key}-slot`} id={slot} ctx={ctx} className="my-8" />);
  });

  return (
    <>
      {secoes.map((nodes, i) =>
        i === 0 ? (
          <div key={i}>{nodes}</div>
        ) : nodes.length ? (
          <div key={i} className="mt-10 border-t border-mn-line pt-8">
            {nodes}
          </div>
        ) : null,
      )}
    </>
  );
}
