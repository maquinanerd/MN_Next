import Link from "next/link";
import type { Trecho } from "@/lib/content/types";

/** Texto corrido tipado: nada de HTML cru vindo do CMS. Link externo abre em nova aba; afiliado leva rel="sponsored". */
export function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) => {
        if (t.tipo === "texto") return <span key={i}>{t.texto}</span>;
        if (t.tipo === "negrito") return <strong key={i}>{t.texto}</strong>;
        if (t.patrocinado)
          return (
            <a
              key={i}
              href={t.href}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="underline underline-offset-3"
            >
              {t.texto}
            </a>
          );
        if (/^https?:\/\//.test(t.href))
          return (
            <a key={i} href={t.href} target="_blank" rel="noopener">
              {t.texto}
            </a>
          );
        return (
          <Link key={i} href={t.href}>
            {t.texto}
          </Link>
        );
      })}
    </>
  );
}
