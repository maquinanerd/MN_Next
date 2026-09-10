import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isReservedTag, safeSlugParam } from '@mn/content';
import { EmptyState } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata, noindexMetadata } from '@mn/seo';

import { Header } from '../../../components/Chrome';
import { FeedSection } from '../../../components/Feed';
import { agora, listView, parsePageQuery, repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Tag archive — where an editoria's subject filters lead ("Marvel", "Streaming"). Page 1
 * is an indexable topic hub; deeper pages are `noindex, follow`, thin slices that would
 * dilute the hub. Reserved tags (layout switches) have no public archive.
 */
export const revalidate = 300;

type Params = { slug: string };
type Search = { page?: string | string[] };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const slug = safeSlugParam((await params).slug);
  const page = parsePageQuery((await searchParams).page);
  const ctx = seoContext();
  if (!slug || isReservedTag(slug)) return { title: 'Tag não encontrada', robots: { index: false } };
  const result = await repo()
    .getTag(slug, 1)
    .catch(() => null);
  if (!result) return { title: 'Tag não encontrada', robots: { index: false } };
  if (page > 1) {
    return noindexMetadata(
      ctx,
      `${result.tag.name} — página ${page}`,
      `Matérias sobre ${result.tag.name}.`,
      `/tag/${slug}?page=${page}`,
    );
  }
  return listingMetadata(ctx, {
    title: result.tag.name,
    description: `Todas as matérias do Máquina Nerd sobre ${result.tag.name}.`,
    path: `/tag/${slug}`,
  });
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const slug = safeSlugParam((await params).slug);
  if (!slug || isReservedTag(slug)) notFound();
  const page = parsePageQuery((await searchParams).page);

  const result = await repo().getTag(slug, page);
  if (!result) notFound();
  if (page > 1 && result.items.length === 0) notFound();

  const ctx = seoContext();
  const view = listView(result);

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [breadcrumbNode(ctx, [{ label: 'Home', href: '/' }, { label: result.tag.name }])])}
      />
      <Header />
      <main id="conteudo" className="wrap pt-20 tab:pt-32">
        <div className="border-b border-line pb-20">
          <p className="m-0 mb-10 text-12 font-bold text-muted">Assunto</p>
          <h1 className="m-0 text-25 leading-none font-extrabold tracking-[-0.03em] tab:text-34">{result.tag.name}</h1>
        </div>
        <FeedSection
          titulo={{ forte: 'Notícias', fraco: `sobre ${result.tag.name}` }}
          itens={view.lista}
          paginacao={view.paginacao}
          hrefPara={(n) => (n === 1 ? `/tag/${slug}` : `/tag/${slug}?page=${n}`)}
          now={agora()}
          vazio={
            <EmptyState
              titulo="Nenhuma matéria com este assunto"
              descricao="Talvez o assunto ainda não tenha sido coberto."
              acao={{ rotulo: 'Buscar no site', href: '/busca' }}
            />
          }
        />
      </main>
    </>
  );
}
