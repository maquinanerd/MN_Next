import type { ReactNode } from "react";
import type { Abertura as AberturaData } from "@/lib/content/adapter";
import { HeroCard } from "@/components/cards/HeroCard";
import { OverlayCard } from "@/components/cards/OverlayCard";
import { SideList } from "@/components/cards/SideList";
import type { LabelModo } from "@/components/ui/EditoriaLabel";
import type { MetaModo } from "@/components/ui/Meta";
import { FitSidebar } from "@/components/ui/FitSidebar";

/**
 * Abertura (home e editoria): manchete em 3/4 da largura, três overlays abaixo e a coluna
 * lateral com as chamadas e o card OpaPreço, ajustada à altura da coluna principal.
 */
export function Abertura({
  dados,
  agora,
  rotulo = "editoria",
  rotuloLateral,
  metaLateral,
  lateralTitulo,
  lateralLabel = "Mais chamadas",
  slot,
  eager = false,
}: {
  dados: AberturaData;
  agora: string;
  rotulo?: LabelModo;
  rotuloLateral?: LabelModo;
  metaLateral?: MetaModo;
  lateralTitulo?: ReactNode;
  lateralLabel?: string;
  slot?: ReactNode;
  eager?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 items-start gap-10 mob:grid-cols-1 mob:gap-y-3.5">
      <div className="col-span-3 flex flex-col gap-6 mob:col-auto mob:gap-3.5">
        <HeroCard chamada={dados.manchete} agora={agora} rotulo={rotulo} eager={eager} />
        {dados.destaques.length > 0 && (
          <div className="grid grid-cols-3 gap-6 mob:grid-cols-1 mob:gap-3.5">
            {dados.destaques.map((c) => (
              <OverlayCard key={c.id} chamada={c} agora={agora} rotulo={rotulo} />
            ))}
          </div>
        )}
      </div>
      {dados.lateral.length > 0 && (
        <FitSidebar slot={slot} label={lateralLabel}>
          {lateralTitulo}
          <SideList
            itens={dados.lateral}
            agora={agora}
            rotulo={rotuloLateral ?? rotulo}
            meta={metaLateral ?? (rotuloLateral === "assunto" ? "tempo" : "tempo-editoria")}
          />
        </FitSidebar>
      )}
    </div>
  );
}
