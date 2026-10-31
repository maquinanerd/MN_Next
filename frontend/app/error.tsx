"use client";

import Link from "next/link";
import { useEffect } from "react";

/** 500 dentro do layout: erro recuperável, sem detalhe técnico para o leitor. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ evt: "erro_de_pagina", digest: error.digest }));
  }, [error]);

  return (
    <main id="conteudo" className="mn-wrap pt-12 pb-20 mob:pt-8">
      <p className="m-0 text-xs font-bold tracking-[.06em] text-mn-red-text uppercase">Erro 500</p>
      <h1 className="mt-3 mb-0 max-w-[640px] text-[34px] leading-[1.1] font-extrabold tracking-[-.03em] mob:text-[26px]">
        Algo deu errado ao montar esta página.
      </h1>
      <p className="mt-4 mb-0 max-w-[560px] text-[17px] leading-[1.6] text-mn-ink-2">
        Já registramos o problema. Tente de novo em alguns segundos.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="h-11 cursor-pointer border-0 bg-mn-red px-6 font-sans text-sm font-bold text-white"
        >
          Tentar de novo
        </button>
        <Link href="/" className="flex h-11 items-center border border-mn-line-3 px-6 text-sm font-semibold">
          Página inicial
        </Link>
      </div>
    </main>
  );
}
