import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Foto } from "@/components/ui/Foto";
import { Meta, type MetaModo } from "@/components/ui/Meta";

/** Manchete: foto 16/8 (4/3 no mobile), gradiente, rótulo no topo, título, resumo e meta. Uma por página. */
export function HeroCard({
  chamada,
  agora,
  rotulo = "editoria",
  meta = "tempo",
  eager = false,
}: {
  chamada: Chamada;
  agora: string;
  rotulo?: LabelModo;
  meta?: MetaModo;
  eager?: boolean;
}) {
  return (
    <Link
      href={chamada.href}
      className="relative block aspect-[16/8] min-h-[300px] overflow-hidden rounded-mn bg-[#111] text-white hover:text-white mob:aspect-[4/3] mob:min-h-0"
    >
      <Foto imagem={chamada.imagem} sizes="(max-width: 760px) 100vw, 75vw" eager={eager} />
      <span className="mn-shade-hero absolute inset-0" />
      <span className="absolute top-5 left-5 flex items-center gap-[7px]">
        <EditoriaLabel chamada={chamada} modo={rotulo} sobreImagem />
      </span>
      <span className="absolute right-5 bottom-5 left-5 flex max-w-[420px] flex-col gap-2 mob:right-4 mob:bottom-4 mob:left-4 mob:max-w-none">
        <span className="text-[clamp(22px,2vw,30px)] leading-[1.12] font-extrabold tracking-[-.03em] mob:text-[22px]">
          {chamada.titulo}
        </span>
        {chamada.resumo && <span className="text-[13px] leading-[1.45] text-white/82">{chamada.resumo}</span>}
        <Meta chamada={chamada} agora={agora} modo={meta} className="mt-2 text-white/60" />
      </span>
    </Link>
  );
}
