"use client";

import { useId, useState } from "react";
import type { Chamada } from "@/lib/content/types";
import { StackCard } from "@/components/cards/StackCard";

interface Aba {
  id: string;
  label: string;
  itens: Chamada[];
}

const POR_VEZ = 4;
const AZUL = "#2B4FD6";

/**
 * Abas e fileira de clipes do "Vídeo em destaque". "Mais vistos" só aparece com dado de
 * audiência (sem dado, sem aba). As setas avançam de quatro em quatro; no mobile a fileira
 * rola na horizontal e as setas somem.
 */
export function VideoRail({ abas }: { abas: Aba[] }) {
  const visiveis = abas.filter((a) => a.itens.length > 0);
  const [ativa, setAtiva] = useState(visiveis[0]?.id);
  const [inicio, setInicio] = useState(0);
  const base = useId();
  const aba = visiveis.find((a) => a.id === ativa) ?? visiveis[0];
  if (!aba) return null;
  const total = aba.itens.length;
  const pagina = aba.itens.slice(inicio, inicio + POR_VEZ);

  const escolher = (id: string) => {
    setAtiva(id);
    setInicio(0);
  };

  return (
    <>
      <div className="mt-4 flex items-center border-b border-mn-line">
        <div role="tablist" aria-label="Vídeos" className="flex items-center">
          {visiveis.map((a, i) => {
            const selected = a.id === aba.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`${base}-tab-${a.id}`}
                aria-selected={selected}
                aria-controls={`${base}-painel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => escolher(a.id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  const next = visiveis[(i + (e.key === "ArrowRight" ? 1 : visiveis.length - 1)) % visiveis.length]!;
                  escolher(next.id);
                  document.getElementById(`${base}-tab-${next.id}`)?.focus();
                }}
                className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent py-2.5 font-sans text-xs ${
                  i < visiveis.length - 1 ? "mr-8" : ""
                } ${selected ? "border-[#5075FC]" : "border-transparent text-mn-ink-3"}`}
                style={selected ? { color: AZUL } : undefined}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto flex gap-1.5 mob:hidden">
          <button
            type="button"
            aria-label="Vídeos anteriores"
            disabled={inicio === 0}
            onClick={() => setInicio((v) => Math.max(0, v - POR_VEZ))}
            className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center border border-mn-line-3 bg-transparent p-0 text-[11px] text-mn-ink before:absolute before:-inset-2.5 disabled:cursor-default disabled:text-mn-muted relative"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximos vídeos"
            disabled={inicio + POR_VEZ >= total}
            onClick={() => setInicio((v) => Math.min(total - 1, v + POR_VEZ))}
            className="relative flex h-[22px] w-[22px] cursor-pointer items-center justify-center border border-mn-line-3 bg-transparent p-0 text-[11px] text-mn-ink before:absolute before:-inset-2.5 disabled:cursor-default disabled:text-mn-muted"
          >
            ›
          </button>
        </span>
      </div>
      <div
        id={`${base}-painel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${aba.id}`}
        className="mn-scroll-row mt-7 grid grid-cols-4 gap-10 mob:flex mob:gap-3 mob:overflow-x-auto mob:*:flex-[0_0_62%]"
      >
        {/* No mobile a fileira rola: todos os clipes da aba; no desktop, quatro por vez. */}
        {aba.itens.map((c, i) => (
          <div key={c.id} className={i >= inicio && i < inicio + POR_VEZ ? "min-w-0" : "hidden min-w-0 mob:block"}>
            <StackCard
              chamada={c}
              rotulo="assunto"
              corRotulo={AZUL}
              meta={false}
              resumo={false}
              play
              proporcao="16/9"
              sizes="(max-width: 760px) 62vw, 25vw"
            />
          </div>
        ))}
        {pagina.length === 0 && <p className="m-0 text-xs text-mn-muted">Sem vídeos nesta aba.</p>}
      </div>
    </>
  );
}
