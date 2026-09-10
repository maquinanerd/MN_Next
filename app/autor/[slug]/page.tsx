import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { EmptyState } from '@mn/ui';
import { JsonLd, absolute, breadcrumbNode, buildGraph, listingMetadata, personPageNode } from '@mn/seo';

import { Header } from '../../../components/Chrome';
import { FeedSection } from '../../../components/Feed';
import { agora, listView, parsePageQuery, repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Author page — no prototype, composed from the editoria header and the RowCard list.
 * Indexable: an author archive is where Google attributes expertise to a byline, and the
 * `ProfilePage` node links the person to the organisation.
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
  if (!slug) return { title: 'Autor não encontrado', robots: { index: false } };
  const result = await repo()
    .getAuthor(slug, 1)
    .catch(() => null);
  if (!result) return { title: 'Autor não encontrado', robots: { index: false } };
  return listingMetadata(seoContext(), {
    title: result.author.name,
    description: result.author.bio ?? `Matérias assinadas por ${result.author.name} no Máquina Nerd.`,
    path: `/autor/${slug}`,
    page,
    pagination: 'query',
  });
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const slug = safeSlugParam((await params).slug);
  if (!slug) notFound();
  const page = parsePageQuery((await searchParams).page);

  const result = await repo().getAuthor(slug, page);
  if (!result) notFound();
  if (page > 1 && result.items.length === 0) notFound();

  const ctx = seoContext();
  const view = listView(result);
  const { author } = result;

  return (
    <>
      <JsonLd
        graph={buildGraph(ctx, [
          personPageNode(ctx, author, absolute(ctx, `/autor/${slug}`)),
          breadcrumbNode(ctx, [{ label: 'Home', href: '/' }, { label: author.name }]),
        ])}
      />
      <Header />
      <main id="conteudo" className="wrap pt-20 tab:pt-32">
        <div className="flex items-center gap-20 border-b border-line pb-20">
          {author.avatar ? (
            <span className="relative block size-64 flex-none overflow-hidden rounded-full bg-media">
              <Image src={author.avatar.url} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ) : null}
          <div>
            <h1 className="m-0 text-25 leading-none font-extrabold tracking-[-0.03em] tab:text-34">{author.name}</h1>
            {author.role ? <p className="mt-8 mb-0 text-12 text-muted">{author.role}</p> : null}
            {author.bio ? (
              <p className="mt-12 mb-0 max-w-[68ch] text-14 leading-[1.5] text-ink-3">{author.bio}</p>
            ) : null}
          </div>
        </div>
        <FeedSection
          titulo={{ forte: 'Matérias', fraco: `de ${author.name}` }}
          itens={view.lista}
          paginacao={view.paginacao}
          hrefPara={(n) => (n === 1 ? `/autor/${slug}` : `/autor/${slug}?page=${n}`)}
          now={agora()}
          vazio={<EmptyState titulo="Nenhuma matéria publicada ainda" acao={{ rotulo: 'Ver a home', href: '/' }} />}
        />
      </main>
    </>
  );
}
