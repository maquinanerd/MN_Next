import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Título de seção com peso misto: a primeira parte em 800, o resto em 300, em caixa-alta.
 * `tamanho`: "secao" (26px, 20px no mobile), "materia" (22px) ou "mais" (18px).
 */
export function SectionTitle({
  forte,
  leve,
  id,
  as: Tag = "h2",
  tamanho = "secao",
  acao,
  className = "",
}: {
  forte: string;
  leve?: string;
  id?: string;
  as?: "h1" | "h2" | "h3";
  tamanho?: "secao" | "materia" | "mais";
  acao?: { href: string; label: string };
  className?: string;
}) {
  const size =
    tamanho === "secao"
      ? "text-[26px] mob:text-xl"
      : tamanho === "materia"
        ? "text-[22px]"
        : "text-lg";
  const titulo: ReactNode = (
    <Tag id={id} className={`m-0 leading-[1.1] font-extrabold tracking-[-.02em] uppercase ${size}`}>
      {forte}
      {leve ? <span className="font-light"> {leve}</span> : null}
    </Tag>
  );
  if (!acao) return <div className={`mb-7 ${className}`}>{titulo}</div>;
  return (
    <div className={`mb-7 flex items-center gap-3 ${className}`}>
      {titulo}
      <Link
        href={acao.href}
        className="ml-auto border border-mn-line-3 px-10 py-[9px] text-xs whitespace-nowrap text-mn-ink mob:px-5"
      >
        {acao.label}
      </Link>
    </div>
  );
}
