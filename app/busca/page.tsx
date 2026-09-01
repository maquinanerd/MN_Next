import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  ArticleGrid,
  Breadcrumbs,
  Editorial,
  EmptyState,
  GridSkeleton,
  Pagination,
  SearchForm,
  SectionHeading,
} from '@mn/ui';
import { noindexMetadata } from '@mn/seo';

import { repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Search.
 *
 * Dynamic and `no-store` end to end (docs/08): a search result is per-reader and must
 * never land in a shared cache. `noindex, follow` keeps an unbounded query space out of
 * the index while letting a crawler follow through to the articles.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? '').trim().slice(0, 120);
  return noindexMetadata(
    seoContext(),
    query ? `Busca por “${query}”` : 'Busca',
    'Busque matérias, análises e especiais no Máquina Nerd.',
    '/busca',
  );
}

async function Results({ query, page }: { query: string; page: number }) {
  if (query.length < 2) {
    return (
      <EmptyState
        title="Digite ao menos duas letras"
        description="A busca cobre título e resumo das matérias publicadas."
      />
    );
  }

  const result = await repo().search(query, page);

  if (result.items.length === 0) {
    return (
      <EmptyState
        title={`Nada encontrado para “${query}”`}
        description="Tente outro termo, ou navegue pelas editorias a partir do menu."
        action={{ label: 'Ver a home', href: '/' }}
      />
    );
  }

  return (
    <>
      <SectionHeading label={`Resultados para “${query}”`} />
      <ArticleGrid articles={result.items} columns={3} showExcerpt />
      <Pagination
        page={page}
        totalPages={result.totalPages}
        hasNext={result.hasNext}
        hrefFor={(n) => `/busca?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ''}`}
      />
    </>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: rawPage } = await searchParams;
  const query = (q ?? '').trim().slice(0, 120);
  const page = Number(rawPage ?? 1) || 1;
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Busca' }];

  return (
    <Editorial>
      <Breadcrumbs items={crumbs} />
      <header className="mn-cathead">
        <h1 className="mn-cathead__title">Busca</h1>
        <Suspense fallback={null}>
          <SearchForm />
        </Suspense>
      </header>

      <div className="mn-section">
        <Suspense fallback={<GridSkeleton count={6} />}>
          <Results query={query} page={page} />
        </Suspense>
      </div>
    </Editorial>
  );
}
