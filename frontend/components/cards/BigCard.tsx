import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Foto } from "@/components/ui/Foto";
import { Meta } from "@/components/ui/Meta";
import { PlayIcon } from "@/components/ui/PlayIcon";

/**
 * Destaque largo com título sobre a foto (ocupa 2 colunas; 16/10 no mobile).
 * `video` é a variante "Vídeo em destaque": 420px de altura e selo de play.
 */
export function BigCard({
  chamada,
  agora,
  rotulo = "completo",
  video = false,
  className = "",
}: {
  chamada: Chamada;
  agora: string;
  rotulo?: LabelModo;
  video?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={chamada.href}
      className={`relative block overflow-hidden rounded-mn bg-[#111] text-white hover:text-white ${
        video ? "min-h-[420px] mob:aspect-[4/3] mob:min-h-0" : "min-h-[300px] mob:aspect-[16/10] mob:min-h-0"
      } ${className}`}
    >
      <Foto imagem={chamada.imagem} sizes={video ? "(max-width: 760px) 100vw, 1364px" : "(max-width: 760px) 100vw, 50vw"} />
      <span className={`absolute inset-0 ${video ? "bg-[linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.7))]" : "mn-shade-big"}`} />
      {video && <PlayIcon size={48} />}
      <span className="absolute top-5 left-5 flex items-center gap-[7px]">
        <EditoriaLabel chamada={chamada} modo={rotulo} sobreImagem />
      </span>
      <span
        className={`absolute right-5 left-5 flex flex-col gap-2 mob:right-4 mob:left-4 ${
          video ? "bottom-6 max-w-[420px] mob:bottom-4" : "bottom-5 max-w-[380px] mob:bottom-4"
        }`}
      >
        <span className="text-xl leading-[1.15] font-extrabold tracking-[-.03em]">{chamada.titulo}</span>
        {chamada.resumo && <span className="text-xs leading-[1.45] text-white/82">{chamada.resumo}</span>}
        {!video && <Meta chamada={chamada} agora={agora} className="mt-2 text-white/60" />}
      </span>
    </Link>
  );
}
