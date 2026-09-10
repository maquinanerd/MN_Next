import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@mn/ui';
import { JsonLd, absolute, breadcrumbNode, buildGraph, collectionNode, listingMetadata } from '@mn/seo';

import { Header } from '../../components/Chrome';
import { FeedSection } from '../../components/Feed';
import { agora, listView, parsePageQuery, repo } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Offers index. No prototype: the editoria header and its list, as the kit asks for
 * surfaces it does not draw. Every item here is an affiliate page and says so on the page.
 */
export const revalidate = 300;

type Search = { page?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const page = parsePageQuery((await searchParams).page);
  return listingMetadata(seoContext(), {
    title: 'Ofertas',
    description: 'Ofertas selecionadas pela redação do Máquina Nerd, com links de afiliados.',
    path: '/ofertas',
    page,
    pagination: 'query',
  });
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const page = parsePageQuery((await searchParams).page);
  const result = await repo().listOffers(page, { perPage: 10 });
  // Page 1 may be empty and says so; a page past the end is not a page.
  if (page > 1 && result.items.length === 0) notFound();
  const view = listView(result);
  const ctx = seoContext();

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [
          collectionNode(ctx, {
            name: 'Ofertas',
            description: 'Ofertas selecionadas pela redação.',
            url: absolute(ctx, '/ofertas'),
            items: result.items,
          }),
          breadcrumbNode(ctx, [{ label: 'Home', href: '/' }, { label: 'Ofertas' }]),
        ])}
      />
      <Header />
      <main id="conteudo" className="wrap pt-20 tab:pt-32">
        <div className="border-b border-line pb-20">
          <h1 className="m-0 text-25 leading-none font-extrabold tracking-[-0.03em] text-mn-red-text tab:text-34">
            Ofertas
          </h1>
          <p className="mt-12 mb-0 max-w-[68ch] text-13 leading-[1.5] text-ink-3">
            Os links de compra destas páginas são de afiliados: o Máquina Nerd pode receber uma comissão, sem custo
            adicional para você.
          </p>
        </div>
        <FeedSection
          titulo={{ forte: 'Todas', fraco: 'as ofertas' }}
          itens={view.lista}
          paginacao={view.paginacao}
          hrefPara={(n) => (n === 1 ? '/ofertas' : `/ofertas?page=${n}`)}
          now={agora()}
          vazio={
            <EmptyState
              titulo="Nenhuma oferta publicada no momento"
              descricao="Quando a redação encontrar um preço que vale a pena, ele aparece aqui."
              acao={{ rotulo: 'Ver a home', href: '/' }}
            />
          }
        />
      </main>
    </>
  );
}
