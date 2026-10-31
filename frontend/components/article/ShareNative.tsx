"use client";

import { useState } from "react";

/** "‹ Compartilhar": abre o compartilhamento do sistema; sem ele, copia o endereço. */
export function ShareNative({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({ url, title: titulo });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Compartilhamento cancelado: nada a fazer.
        }
      }}
      className="relative ml-0 flex h-[22px] cursor-pointer items-center gap-1.5 border border-mn-line-3 bg-transparent px-2.5 font-sans text-[10px] text-mn-muted before:absolute before:-inset-1.5 before:content-['']"
    >
      <span aria-live="polite">{copiado ? "Endereço copiado" : "‹ Compartilhar"}</span>
    </button>
  );
}
