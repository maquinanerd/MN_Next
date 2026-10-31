import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Foto } from "@/components/ui/Foto";
import { Meta, type MetaModo } from "@/components/ui/Meta";

/**
 * Chamada com título sobre a foto: 4/3, 3/4 até 1100px e 16/10 no mobile. Usada ao lado
 * da manchete e nas relacionadas da matéria.
 */
export function OverlayCard({
  chamada,
  agora,
  rotulo = "editoria",
  meta = "tempo-editoria",
  sizes = "(max-width: 760px) 100vw, 25vw",
}: {
  chamada: Chamada;
  agora: string;
  rotulo?: LabelModo;
  meta?: MetaModo | "autor";
  sizes?: string;
}) {
  const autores = chamada.autores?.map((a) => a.nome).join(" e ");
  return (
    <Link
      href={chamada.href}
      className="relative block aspect-[4/3] min-w-0 overflow-hidden rounded-mn bg-[#111] text-white hover:text-white le1100:aspect-[3/4] mob:aspect-[16/10]"
    >
      <Foto imagem={chamada.imagem} sizes={sizes} />
      <span className="mn-shade absolute inset-0" />
      <span className="absolute top-4 left-4 flex items-center gap-1.5">
        <EditoriaLabel chamada={chamada} modo={rotulo} sobreImagem />
      </span>
      <span className="absolute right-4 bottom-4 left-4 flex flex-col gap-1.5 mob:right-3.5 mob:bottom-3.5 mob:left-3.5">
        <span className="mn-clamp-3 text-[15px] leading-[1.25] font-bold tracking-[-.015em] mob:text-base">
          {chamada.titulo}
        </span>
        {meta === "autor" ? (
          autores ? <span className="text-[11px] text-white/60">Por {autores}</span> : null
        ) : (
          <Meta chamada={chamada} agora={agora} modo={meta} className="text-white/60" />
        )}
      </span>
    </Link>
  );
}
