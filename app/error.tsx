'use client';

import { useEffect } from 'react';

import { Header } from '../components/Chrome';

/**
 * Segment error boundary. A Kal El outage degrades to this — a real error state with a
 * retry and a reference an operator can search for — never to a blank 200. `digest` is
 * the server-side correlation Next computed; the message itself never reaches the browser.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[mn] render error', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <>
      <Header />
      <main id="conteudo" className="wrap py-48 tab:py-80">
        <h1 className="m-0 text-25 leading-[1.12] font-extrabold tracking-[-0.035em] tab:text-34">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-16 mb-0 max-w-[60ch] text-15 leading-[1.5] text-ink-3">
          Houve uma falha ao buscar o conteúdo. Tente novamente em alguns instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-24 inline-flex h-44 cursor-pointer items-center border border-mn-red bg-mn-red px-20 text-13 font-bold text-white"
        >
          Tentar novamente
        </button>
        {error.digest ? (
          <p className="mt-24 mb-0 text-12 text-muted">
            Referência: <code>{error.digest}</code>
          </p>
        ) : null}
      </main>
    </>
  );
}
