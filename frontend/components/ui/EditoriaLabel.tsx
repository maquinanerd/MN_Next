import type { Chamada } from "@/lib/content/types";

export type LabelModo = "editoria" | "assunto" | "completo";

export function labelText(chamada: Chamada, modo: LabelModo): string {
  const { editoria, assunto } = chamada;
  if (modo === "assunto") return assunto ?? editoria.nome;
  if (modo === "completo" && assunto) return `${editoria.nome} | ${assunto}`;
  return editoria.nome;
}

/**
 * Rótulo de editoria (12px/700). Sobre fundo claro usa sempre a variante de texto da
 * editoria (≥ 4,5:1); sobre foto, branco.
 */
export function EditoriaLabel({
  chamada,
  modo = "editoria",
  cor,
  sobreImagem = false,
  className = "",
}: {
  chamada: Chamada;
  modo?: LabelModo;
  cor?: string;
  sobreImagem?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`text-xs leading-none font-bold tracking-[-.01em] ${className}`}
      style={{ color: sobreImagem ? "#fff" : (cor ?? chamada.editoria.corTexto) }}
    >
      {labelText(chamada, modo)}
    </span>
  );
}
