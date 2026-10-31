import Link from "next/link";
import { ON_COLOR } from "@/lib/content/editorias";

/** Página 1 fica na raiz da lista; as demais em `/page/n`. */
export function pageHref(base: string, n: number): string {
  const root = base === "/" ? "" : base;
  return n <= 1 ? base || "/" : `${root}/page/${n}`;
}

/** "1 2 3 4 … 24": sempre a primeira, a última e a vizinhança da atual. */
export function pageItems(atual: number, total: number): (number | "…")[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, atual - 1, atual, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (atual >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push("…");
    out.push(n);
  });
  return out;
}

const box = "box-border flex h-9 items-center justify-center border text-sm";

/** Quadrados de 36px, atual preenchido na cor da seção, reticências em cinza, setas ‹ ›. Quebra linha no mobile. */
export function Pagination({
  atual,
  total,
  base,
  cor = "#E30613",
  textoSobreCor = "light",
  href = (n) => pageHref(base, n),
}: {
  atual: number;
  total: number;
  base: string;
  /** Endereço de cada página; por padrão `base/page/n` (a busca usa `?pagina=n`). */
  href?: (n: number) => string;
  cor?: string;
  textoSobreCor?: "light" | "dark";
}) {
  if (total <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {atual > 1 ? (
        <Link href={href(atual - 1)} aria-label="Página anterior" className={`${box} w-9 border-mn-line-3 text-mn-muted`}>
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} w-9 border-mn-line-3 text-mn-muted opacity-50`}>
          ‹
        </span>
      )}
      {pageItems(atual, total).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} aria-hidden="true" className={`${box} min-w-9 border-transparent px-2.5 text-[13px] font-semibold text-mn-muted`}>
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-label={`Página ${n}`}
            aria-current={n === atual ? "page" : undefined}
            className={`${box} min-w-9 px-2.5 text-[13px] font-semibold`}
            style={
              n === atual
                ? { background: cor, borderColor: cor, color: ON_COLOR[textoSobreCor] }
                : { borderColor: "#E1E1E1", color: "#111" }
            }
          >
            {n}
          </Link>
        ),
      )}
      {atual < total ? (
        <Link href={href(atual + 1)} aria-label="Próxima página" className={`${box} w-9 border-mn-line-3 text-mn-ink`}>
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} w-9 border-mn-line-3 text-mn-muted opacity-50`}>
          ›
        </span>
      )}
    </nav>
  );
}
