import Link from 'next/link';
import type { Metadata } from 'next';

import { Header } from '../components/Chrome';
import { EDITORIAS } from '../lib/content/editorias';

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: true },
};

/**
 * 404 — a real 404 status (no route-level `loading.tsx` exists to turn it into a 200).
 * `follow` without `index`: a crawler arriving from a stale link still follows the
 * editorias out, so the archive stays reachable.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="conteudo" className="wrap py-48 tab:py-80">
        <p className="m-0 text-12 font-bold text-muted">Erro 404</p>
        <h1 className="mt-12 mb-0 text-25 leading-[1.12] font-extrabold tracking-[-0.035em] tab:text-34">
          Essa página não existe mais
        </h1>
        <p className="mt-16 mb-0 max-w-[60ch] text-15 leading-[1.5] text-ink-3">
          O endereço pode ter mudado, ou a matéria pode ter sido removida. As editorias continuam no mesmo lugar.
        </p>
        <nav aria-label="Editorias do site" className="mt-24 flex flex-wrap gap-6">
          {Object.values(EDITORIAS).map((e) => (
            <Link
              key={e.slug}
              href={e.href}
              className="border border-control px-14 py-7 text-12 font-semibold text-ink"
            >
              {e.nome}
            </Link>
          ))}
        </nav>
        <div className="mt-24 flex flex-wrap gap-8">
          <Link
            href="/"
            className="inline-flex h-44 items-center border border-mn-red bg-mn-red px-20 text-13 font-bold text-white hover:text-white"
          >
            Ir para a home
          </Link>
          <Link
            href="/busca"
            className="inline-flex h-44 items-center border border-control px-20 text-13 font-bold text-ink"
          >
            Buscar no site
          </Link>
        </div>
      </main>
    </>
  );
}
