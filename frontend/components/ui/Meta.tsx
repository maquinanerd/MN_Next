import type { Chamada } from "@/lib/content/types";
import { dataRelativa } from "@/lib/format/date";

export type MetaModo = "tempo" | "tempo-editoria" | "autor-tempo";

function autores(chamada: Chamada): string | undefined {
  const nomes = chamada.autores?.map((a) => a.nome) ?? [];
  if (!nomes.length) return undefined;
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/** Metadados: "6 horas atrás | Animes", "Por Rafael Lima · 5 horas atrás". */
export function Meta({
  chamada,
  agora,
  modo = "tempo",
  className = "",
}: {
  chamada: Chamada;
  agora: string;
  modo?: MetaModo;
  className?: string;
}) {
  const tempo = <time dateTime={chamada.publicadoEm}>{dataRelativa(chamada.publicadoEm, agora)}</time>;
  const por = autores(chamada);
  return (
    <div className={`text-[11px] leading-normal ${className}`}>
      {modo === "autor-tempo" && por ? (
        <>
          Por {por} · {tempo}
        </>
      ) : (
        tempo
      )}
      {modo === "tempo-editoria" && <> | {chamada.formato === "video" ? "Vídeos" : chamada.editoria.nome}</>}
    </div>
  );
}
