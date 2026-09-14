import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { EmptyState, Pagination, RowCard, SearchForm } from '@mn/ui';
import { serverEnv } from '@mn/content/env';
import { noindexMetadata } from '@mn/seo';

import { Header } from '../../components/Chrome';
import { porQuem, rotulo } from '../../components/meta';
import { agora, listView, repo } from '../../lib/content';
import { SEARCH_MAX_PAGES, searchAllowed, searchPage } from '../../lib/search';
import { seoContext } from '../../lib/seo-context';

/**
 * Search. No prototype (kit docs/03): composed from the editoria header and the RowCard
 * list. Dynamic and `no-store` end to end — a result is per-reader and never lands in a
 * shared cache — and `noindex, follow`, so an unbounded query space stays out of the
 * index while a crawler can still follow through to the articles.
 *
 * Each search is an uncached CMS query, so it is bounded twice (`lib/search.ts`): five
 * result pages, and a per-client rate that, once exceeded, renders a notice instead of
 * asking the CMS. A Server Component cannot answer 429; the notice is the honest version.
 */
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

/** A repeated `?q=` is not a query. */
function queryOf(q: string | string[] | undefined): string {
  return (typeof q === 'string' ? q : '').trim().slice(0, 120);
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const query = queryOf((await searchParams).q);
  return noindexMetadata(
    seoContext(),
    query ? `Busca por “${query}”` : 'Busca',
    'Busque notícias, críticas e especiais no Máquina Nerd.',
    '/busca',
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, page: rawPage } = await searchParams;
  const query = queryOf(q);
  const page = searchPage(rawPage);
  const now = agora();

  // Only a search that would reach the CMS is counted: the empty form costs nothing.
  const searches = query.length >= 2;
  const limited = searches && !searchAllowed(await headers(), serverEnv().RATE_LIMIT_MAX);
  const result = searches && !limited ? listView(await repo().search(query, page)) : null;

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

        {limited ? (
          <EmptyState
            titulo="Muitas buscas em pouco tempo"
            descricao="Espere um minuto e tente de novo. Enquanto isso, as editorias estão no menu."
            acao={{ rotulo: 'Ver a home', href: '/' }}
          />
        ) : result === null ? (
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
              // Never a link to a page past the ceiling, which would be a 404.
              paginacao={{
                ...result.paginacao,
                total: result.paginacao.total === null ? null : Math.min(result.paginacao.total, SEARCH_MAX_PAGES),
                temProxima: result.paginacao.temProxima && page < SEARCH_MAX_PAGES,
              }}
              hrefPara={(n) => `/busca?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ''}`}
            />
          </section>
        )}
      </main>
    </>
  );
}
