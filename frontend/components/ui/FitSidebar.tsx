"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Lateral que nunca fica mais alta que a coluna principal (docs/05, regra 2).
 *
 * A grade estica a lateral até a altura da linha (`align-self: stretch`) e o conteúdo é
 * posicionado em `inset: 0`. As chamadas ficam numa coluna flexível com quebra: a que
 * não cabe inteira vai para uma segunda coluna, fora da área visível — o corte é feito
 * pelo CSS já na primeira pintura, sem salto de layout. Este efeito só tira essas chamadas
 * da árvore de acessibilidade e da tabulação (ResizeObserver + `document.fonts.ready`).
 * O card OpaPreço fica no rodapé da coluna; abaixo de 1180px some, e no mobile a lateral
 * volta ao fluxo normal com todas as chamadas.
 */
export function FitSidebar({
  children,
  slot,
  className = "",
  label,
}: {
  children: ReactNode;
  slot?: ReactNode;
  className?: string;
  label?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const inner = innerRef.current;
    if (!list || !inner) return;
    const fit = () => {
      const items = [...list.children] as HTMLElement[];
      items.forEach((el) => {
        el.hidden = false;
        el.removeAttribute("inert");
      });
      if (getComputedStyle(list).overflow === "visible") return;
      const left = list.getBoundingClientRect().left;
      items.forEach((el, i) => {
        // O primeiro item fica sempre; os que quebraram para a 2ª coluna saem.
        if (i > 0 && el.getBoundingClientRect().left - left > 1) el.hidden = true;
      });
    };
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };
    fit();
    const ro = new ResizeObserver(schedule);
    ro.observe(inner);
    ro.observe(list);
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <aside aria-label={label} className={`mn-fit ${className}`}>
      <div ref={innerRef} className="mn-fit-in">
        <div ref={listRef} className="mn-fit-list">
          {children}
        </div>
        {slot && <div className="mn-fit-slot">{slot}</div>}
      </div>
    </aside>
  );
}
