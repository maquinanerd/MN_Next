import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RowCard } from "@/components/cards/RowCard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Pagination } from "@/components/ui/Pagination";
import { searchContent } from "@/lib/content";
import { EDITORIA_SLUGS, EDITORIAS } from "@/lib/content/editorias";

type SP = Promise<Record<string, string | string[] | undefined>>;

function termo(sp: Record<string, string | string[] | undefined>): string {
  const q = sp.q;
  return (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const q = termo(await searchParams);
  return {
    title: q ? `Busca: ${q}` : "Busca",
    // Página de resultados não entra no índice (conteúdo duplicado e infinito).
    robots: { index: false, follow: true },
    alternates: { canonical: "/busca" },
  };
}

function Formulario({ q }: { q: string }) {
  return (
    <form action="/busca" role="search" className="flex gap-2 mob:flex-col">
      <label htmlFor="busca-q" className="sr-only">
        Buscar no Máquina Nerd
      </label>
      <input
        id="busca-q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Filmes, séries, games, quadrinhos…"
        className="h-11 min-w-0 flex-1 border border-mn-line-3 px-3 font-sans text-[15px] placeholder:text-mn-muted"
      />
      <button type="submit" className="h-11 cursor-pointer border-0 bg-mn-red px-6 font-sans text-sm font-bold text-white">
        Buscar
      </button>
    </form>
  );
}

async function Resultados({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = termo(sp);
  const raw = Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina;
  const pagina = raw && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
  if (!q) {
    return (
      <>
        <Formulario q="" />
        <p className="mt-6 text-sm text-mn-ink-3">Digite um termo para buscar nas notícias do Máquina Nerd.</p>
      </>
    );
  }
  const r = await searchContent(q, pagina);
  return (
    <>
      <Formulario q={q} />
      <p role="status" className="mt-6 mb-0 text-sm text-mn-ink-3">
        {r.itens.length
          ? `Resultados para “${q}”${r.totalPaginas > 1 ? ` · página ${r.pagina} de ${r.totalPaginas}` : ""}`
          : `Nenhum resultado para “${q}”.`}
      </p>
      {r.itens.length ? (
        <div className="max-w-[1000px]">
          {r.itens.map((c) => (
            <RowCard key={c.id} chamada={c} agora={r.agora} />
          ))}
          <Pagination
            atual={r.pagina}
            total={r.totalPaginas}
            base="/busca"
            href={(n) => `/busca?q=${encodeURIComponent(q)}${n > 1 ? `&pagina=${n}` : ""}`}
          />
        </div>
      ) : (
        <div className="mt-6">
          <p className="m-0 mb-3 text-sm">Tente outro termo ou navegue pelas editorias:</p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {EDITORIA_SLUGS.map((s) => (
              <li key={s}>
                <Link href={`/${s}`} className="block border border-mn-line-3 px-3.5 py-[7px] text-xs font-semibold">
                  {EDITORIAS[s].nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Busca: dinâmica (lê a query a cada requisição), fora do índice. */
export default function BuscaPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mn-wrap pt-8 pb-16 mob:pt-5">
        <h1 className="m-0 mb-6 border-b border-mn-line pb-5 text-[34px] leading-none font-extrabold tracking-[-.03em] mob:text-[28px]">
          Busca
        </h1>
        <Suspense
          fallback={
            <>
              <Formulario q="" />
              <p className="mt-6 text-sm text-mn-muted">Buscando…</p>
            </>
          }
        >
          <Resultados searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
