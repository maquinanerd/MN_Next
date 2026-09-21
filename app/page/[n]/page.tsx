import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listingMetadata } from '@mn/seo';

import { Header } from '../../../components/Chrome';
import { FeedSection } from '../../../components/Feed';
import { agora, latestView, parsePage } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * `/page/{n}`: "Mais do Máquina Nerd", continued past the home. Self-canonical, like every
 * paginated archive; page 1 is the home itself.
 */
export const revalidate = 120;

type Params = { n: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = parsePage((await params).n);
  return listingMetadata(seoContext(), {
    title: 'Mais do Máquina Nerd',
    description: 'Todas as notícias do Máquina Nerd, da mais recente para a mais antiga.',
    path: '',
    page,
  });
}

export default async function LatestPage({ params }: { params: Promise<Params> }) {
  const page = parsePage((await params).n);
  // Page 1 is `/`, and `middleware.ts` sends it there: redirected from this cached page,
  // the answer would come back from the cache with no `Location`.
  if (page === 1) notFound();
  const view = await latestView(page);
  if (view.feed.length === 0) notFound();
  const now = agora();

  return (
    <>
      <Header ativo="Notícias" />
      <main id="conteudo" className="wrap pt-20 tab:pt-32">
        <FeedSection
          as="h1"
          titulo={{ forte: 'Mais', fraco: `do Máquina Nerd — página ${page}` }}
          itens={view.feed}
          paginacao={view.paginacao}
          hrefPara={(n) => (n === 1 ? '/' : `/page/${n}`)}
          now={now}
          anunciosACada3
        />
      </main>
    </>
  );
}
