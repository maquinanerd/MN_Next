import { Fragment, type ReactNode } from "react";
import type { Chamada } from "@/lib/content/types";
import type { SlotContext, SlotId } from "@/lib/ads/slots";
import { RowCard } from "@/components/cards/RowCard";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import type { LabelModo } from "@/components/ui/EditoriaLabel";
import { Pagination } from "@/components/ui/Pagination";

/**
 * Lista "Mais do Máquina Nerd" / "Todas as notícias": RowCards com um card OpaPreço a cada
 * 3 itens, paginação ao fim e, a partir de 1024px, dois cards fixos (sticky) na lateral.
 * Abaixo de 1024px a lateral não existe e a lista ocupa a largura toda.
 */
export function Feed({
  itens,
  agora,
  pagina,
  totalPaginas,
  base,
  cor,
  textoSobreCor,
  rotulo,
  inline,
  sticky,
  ctx,
  antesDaPaginacao,
}: {
  itens: Chamada[];
  agora: string;
  pagina: number;
  totalPaginas: number;
  base: string;
  cor?: string;
  textoSobreCor?: "light" | "dark";
  rotulo?: LabelModo;
  inline: SlotId;
  sticky: SlotId;
  ctx: SlotContext;
  antesDaPaginacao?: ReactNode;
}) {
  // A lateral nunca passa da altura da lista: cada RowCard tem ~245px e cada card OpaPreço
  // vertical 416px, então com menos de 3 notícias cabe um card só, e com uma, nenhum.
  const fixos = itens.length >= 3 ? 2 : itens.length === 2 ? 1 : 0;
  if (!itens.length) {
    return (
      <p className="m-0 py-6 text-[13px] text-mn-summary">
        Nenhuma notícia por aqui ainda. Volte em breve ou explore as outras editorias.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-4 items-start gap-10 mob:grid-cols-1">
      <div className="col-span-3 lt1024:col-span-4 mob:col-auto">
        {itens.map((c, i) => (
          <Fragment key={c.id}>
            <RowCard chamada={c} agora={agora} rotulo={rotulo} />
            {(i + 1) % 3 === 0 && (
              <OpaSlot
                id={inline}
                ctx={{ ...ctx, index: (i + 1) / 3 - 1 }}
                className="border-b border-mn-line py-6"
              />
            )}
          </Fragment>
        ))}
        {antesDaPaginacao}
        <Pagination atual={pagina} total={totalPaginas} base={base} cor={cor} textoSobreCor={textoSobreCor} />
      </div>
      <aside aria-label="Ofertas" className="flex flex-col gap-6 self-stretch lt1024:hidden">
        <div className="sticky top-6 flex flex-col gap-6">
          {Array.from({ length: fixos }, (_, index) => (
            <OpaSlot key={index} id={sticky} ctx={{ ...ctx, index }} orientacao="narrow" />
          ))}
        </div>
      </aside>
    </div>
  );
}
