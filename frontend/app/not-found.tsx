import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { EDITORIA_SLUGS, EDITORIAS } from "@/lib/content/editorias";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

/** 404: estado vazio explicativo com saídas para a busca, a home e as editorias. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mn-wrap pt-12 pb-20 mob:pt-8">
        <p className="m-0 text-xs font-bold tracking-[.06em] text-mn-red-text uppercase">Erro 404</p>
        <h1 className="mt-3 mb-0 max-w-[640px] text-[34px] leading-[1.1] font-extrabold tracking-[-.03em] mob:text-[26px]">
          Não encontramos esta página.
        </h1>
        <p className="mt-4 mb-0 max-w-[560px] text-[17px] leading-[1.6] text-mn-ink-2">
          O endereço pode ter mudado ou a matéria saiu do ar. Tente a busca ou volte para a página inicial.
        </p>
        <form action="/busca" role="search" className="mt-8 flex max-w-[560px] gap-2 mob:flex-col">
          <label htmlFor="nf-q" className="sr-only">
            Buscar no Máquina Nerd
          </label>
          <input
            id="nf-q"
            name="q"
            type="search"
            className="h-11 min-w-0 flex-1 border border-mn-line-3 px-3 font-sans text-[15px]"
          />
          <button
            type="submit"
            className="h-11 cursor-pointer border-0 bg-mn-red px-6 font-sans text-sm font-bold text-white"
          >
            Buscar
          </button>
        </form>
        <div className="mt-10 flex flex-wrap gap-1.5">
          <Link href="/" className="border border-mn-line-3 px-3.5 py-[7px] text-xs font-semibold">
            Página inicial
          </Link>
          {EDITORIA_SLUGS.map((s) => (
            <Link
              key={s}
              href={`/${s}`}
              className="border border-mn-line-3 px-3.5 py-[7px] text-xs font-semibold"
            >
              {EDITORIAS[s].nome}
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
