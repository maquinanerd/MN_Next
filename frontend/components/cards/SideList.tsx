import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Meta, type MetaModo } from "@/components/ui/Meta";

/** Item da coluna lateral: rótulo, título de 14px, meta e divisor. Sem imagem. */
export function SideItem({
  chamada,
  agora,
  rotulo = "editoria",
  meta = "tempo-editoria",
}: {
  chamada: Chamada;
  agora: string;
  rotulo?: LabelModo;
  meta?: MetaModo;
}) {
  return (
    <article className="box-border flex w-full flex-col gap-2 border-b border-mn-line pt-2.5 pb-3">
      <div className="flex items-center gap-1.5">
        <EditoriaLabel chamada={chamada} modo={rotulo} />
      </div>
      <h3 className="m-0 text-sm leading-[1.3] font-bold tracking-[-.01em]">
        <Link href={chamada.href}>
          {chamada.formato === "video" && (
            <>
              <span aria-hidden="true">▶ </span>
              <span className="sr-only">Vídeo: </span>
            </>
          )}
          {chamada.titulo}
        </Link>
      </h3>
      <Meta chamada={chamada} agora={agora} modo={meta} className="text-mn-muted" />
    </article>
  );
}

export function SideList({
  itens,
  agora,
  rotulo,
  meta,
}: {
  itens: Chamada[];
  agora: string;
  rotulo?: LabelModo;
  meta?: MetaModo;
}) {
  return (
    <>
      {itens.map((c) => (
        <SideItem key={c.id} chamada={c} agora={agora} rotulo={rotulo} meta={meta} />
      ))}
    </>
  );
}
