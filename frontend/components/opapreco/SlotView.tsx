"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Raiz do slot (`.op-slot`, contêiner das container queries). Conta a impressão quando
 * pelo menos metade do criativo fica visível por 1 s (ad-response.schema.json), uma vez
 * por carregamento. Sem `impressionUrl` (demonstração), não conta nada.
 */
export function SlotView({
  slot,
  className,
  style,
  impressionUrl,
  children,
}: {
  slot: string;
  className: string;
  style?: CSSProperties;
  impressionUrl?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !impressionUrl) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (sent) return;
        if (entry && entry.intersectionRatio >= 0.5) {
          timer ??= setTimeout(() => {
            sent = true;
            io.disconnect();
            if (!navigator.sendBeacon?.(impressionUrl)) {
              void fetch(impressionUrl, { method: "POST", keepalive: true, mode: "no-cors" }).catch(() => {});
            }
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, 0.5] },
    );
    io.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [impressionUrl]);

  return (
    <div ref={ref} data-op-slot={slot} className={className} style={style}>
      {children}
    </div>
  );
}
