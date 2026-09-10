import type { Metadata } from 'next';
import { EmptyState, Pagination, RowCard, SearchForm } from '@mn/ui';
import { noindexMetadata } from '@mn/seo';

import { Header } from '../../components/Chrome';
import { porQuem, rotulo } from '../../components/meta';
import { agora, listView, repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Search. No prototype (kit docs/03): composed from the editoria header and the RowCard
 * list. Dynamic and `no-store` end to end — a result is per-reader and never lands in a
 * shared cache — and `noindex, follow`, so an unbounded query space stays out of the
 * index while a crawler can still follow through to the articles.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const query = ((await searchParams).q ?? '').trim().slice(0, 120);
  return noindexMetadata(
    seoContext(),
    query ? `Busca por “${query}”` : 'Busca',
    'Busque notícias, críticas e especiais no Máquina Nerd.',
    '/busca',
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: rawPage } = await searchParams;
  const query = (q ?? '').trim().slice(0, 120);
  const page = Math.min(Math.max(Number(rawPage ?? 1) || 1, 1), 50);
  const now = agora();

  const result = query.length >= 2 ? listView(await repo().search(query, page)) : null;

  return (
    <>
      <Header />
      <main id="conteudo" className="wrap pt-20 pb-64 tab:pt-32">
        <div className="mb-28 border-b border-line pb-20">
          <h1 className="m-0 mb-20 text-25 leading-none font-extrabold tracking-[-0.03em] tab:text-34">Busca</h1>
          <div className="max-w-640">
            <SearchForm action="/busca" defaultValue={query} />
          </div>
        </div>

        {result === null ? (
          <EmptyState
            titulo="Digite ao menos duas letras"
            descricao="A busca cobre o título das matérias publicadas."
          />
        ) : result.lista.length === 0 ? (
          <EmptyState
            titulo={`Nada encontrado para “${query}”`}
            descricao="Tente outro termo, ou navegue pelas editorias a partir do menu."
            acao={{ rotulo: 'Ver a home', href: '/' }}
          />
        ) : (
          <section aria-labelledby="resultados" className="tab:max-w-[75%]">
            <h2
              id="resultados"
              className="m-0 text-20 leading-[1.1] font-extrabold tracking-[-0.02em] uppercase tab:text-26"
            >
              Resultados<span className="font-light"> para “{query}”</span>
            </h2>
            {result.lista.map((c) => (
              <RowCard key={c.id} chamada={c} kicker={rotulo(c)} meta={porQuem(c, now)} />
            ))}
            <Pagination
              paginacao={result.paginacao}
              hrefPara={(n) => `/busca?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ''}`}
            />
          </section>
        )}
      </main>
    </>
  );
}
