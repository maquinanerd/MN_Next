"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_AGE_MS } from "@/lib/ads/constants";

export type EstadoForcado = "hover" | "focus" | "active" | "disabled";

/**
 * O elemento clicável único de cada oferta (spec §5): `<a target="_blank"
 * rel="sponsored noopener">` com `aria-label` completo. Revalida a oferta quando ela
 * aparece na tela e no clique: se passou de `expiresAt`, ou se a verificação de preço tem
 * mais de 6 h, a oferta vira "indisponível" (sem href, `aria-disabled`) em vez de levar o
 * leitor a um preço que não vale mais.
 */
export function OfferLink({
  href,
  ariaLabel,
  className,
  component,
  checkedAt,
  expiresAt,
  estado,
  children,
}: {
  href: string;
  ariaLabel: string;
  className: string;
  component?: string;
  checkedAt?: string;
  expiresAt?: string;
  estado?: EstadoForcado;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [expired, setExpired] = useState(estado === "disabled");

  const isExpired = useCallback(() => {
    const now = Date.now();
    if (expiresAt && Date.parse(expiresAt) < now) return true;
    return !!checkedAt && now - Date.parse(checkedAt) > MAX_AGE_MS;
  }, [checkedAt, expiresAt]);

  useEffect(() => {
    const el = ref.current;
    if (!el || estado) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && isExpired()) setExpired(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [estado, isExpired]);

  const forced = estado && estado !== "disabled" ? ` is-${estado}` : "";
  if (expired) {
    return (
      <a
        ref={ref}
        role="link"
        aria-disabled="true"
        aria-label={`${ariaLabel} Oferta indisponível.`}
        data-ad-component={component}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="sponsored noopener"
      aria-label={ariaLabel}
      data-ad-component={component}
      className={`${className}${forced}`}
      onClick={(event) => {
        if (isExpired()) {
          event.preventDefault();
          setExpired(true);
        }
      }}
    >
      {children}
    </a>
  );
}
