import Link from "next/link";
import type { Chamada } from "@/lib/content/types";
import { EditoriaLabel, type LabelModo } from "@/components/ui/EditoriaLabel";
import { Foto } from "@/components/ui/Foto";
import { Meta, type MetaModo } from "@/components/ui/Meta";
import { PlayIcon } from "@/components/ui/PlayIcon";

/**
 * Card de grade: foto 3/2 (16/9 nos clipes) sobre rótulo, título, resumo e meta.
 * A foto repete o link do título, então sai da ordem de tabulação e da árvore de acessibilidade.
 */
export function StackCard({
  chamada,
  agora,
  rotulo,
  corRotulo,
  meta = "tempo",
  resumo = true,
  play = false,
  proporcao = "3/2",
  sizes = "(max-width: 760px) 62vw, 25vw",
}: {
  chamada: Chamada;
  agora?: string;
  rotulo?: LabelModo | false;
  corRotulo?: string;
  meta?: MetaModo | false;
  resumo?: boolean;
  play?: boolean;
  proporcao?: "3/2" | "16/9";
  sizes?: string;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5">
      <Link
        href={chamada.href}
        tabIndex={-1}
        aria-hidden="true"
        className={`relative block overflow-hidden rounded-mn bg-mn-media ${proporcao === "16/9" ? "aspect-video" : "aspect-[3/2]"}`}
      >
        <Foto imagem={chamada.imagem} sizes={sizes} />
        {play && <PlayIcon size={proporcao === "16/9" ? 30 : 34} />}
      </Link>
      {rotulo !== false && rotulo && (
        <div className="flex items-center gap-1.5">
          <EditoriaLabel chamada={chamada} modo={rotulo} cor={corRotulo} />
        </div>
      )}
      <h3 className="m-0 text-sm leading-[1.3] font-bold tracking-[-.01em]">
        <Link href={chamada.href}>{chamada.titulo}</Link>
      </h3>
      {resumo && chamada.resumo && (
        <p className="m-0 text-xs leading-[1.45] text-mn-summary">{chamada.resumo}</p>
      )}
      {meta !== false && agora && (
        <Meta chamada={chamada} agora={agora} modo={meta} className="text-mn-muted" />
      )}
    </article>
  );
}
