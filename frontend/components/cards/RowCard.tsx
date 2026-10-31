import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Foto } from "@/components/ui/Foto";
import { Meta } from "@/components/ui/Meta";

/** Lista "todas as notícias": foto de 296px 3/2 à esquerda, título, resumo e assinatura. Empilha no mobile. */
export function RowCard({ chamada, agora, rotulo = "editoria" }: { chamada: Chamada; agora: string; rotulo?: LabelModo }) {
  return (
    <article className="grid grid-cols-[296px_minmax(0,1fr)] gap-8 border-b border-mn-line py-6 mob:grid-cols-1 mob:gap-3.5">
      <Link href={chamada.href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[3/2] overflow-hidden rounded-mn bg-mn-media">
        <Foto imagem={chamada.imagem} sizes="(max-width: 760px) 100vw, 296px" />
      </Link>
      <div className="flex max-w-[520px] flex-col gap-2.5 mob:max-w-none">
        <EditoriaLabel chamada={chamada} modo={rotulo} />
        <h3 className="m-0 text-[17px] leading-[1.3] font-bold tracking-[-.015em]">
          <Link href={chamada.href}>{chamada.titulo}</Link>
        </h3>
        {chamada.resumo && <p className="m-0 text-[13px] leading-normal text-mn-summary">{chamada.resumo}</p>}
        <Meta chamada={chamada} agora={agora} modo="autor-tempo" className="mt-1 text-mn-ink-3" />
      </div>
    </article>
  );
}
