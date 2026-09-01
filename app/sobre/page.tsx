import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, Editorial } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata } from '@mn/seo';
import { SITE } from '@mn/content';

import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Quem somos',
    description: 'Quem faz o Máquina Nerd, como apuramos e como corrigimos.',
    path: '/sobre',
  });
}

export default function AboutPage() {
  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Quem somos' }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Quem somos</h1>
        </header>

        <div className="mn-prose mn-section">
          <p>
            O Máquina Nerd cobre cultura pop: cinema, séries, quadrinhos, games e animes. Publicamos notícia diária,
            especiais de franquia, análises e conteúdo comercial claramente identificado.
          </p>

          <h2>Como apuramos</h2>
          <p>
            Toda matéria indica a origem da informação. Quando a fonte é um comunicado, dizemos que é um comunicado.
            Quando é uma pessoa que pediu para não ser identificada, dizemos isso também, e explicamos por quê. Números
            de audiência e bilheteria trazem o medidor e a janela de medição.
          </p>

          <h2>Conteúdo comercial</h2>
          <p>
            Publieditorial, campanhas e conteúdo com link de afiliado carregam um selo acima do título, sempre visível.
            Links de compra usam <code>rel=&quot;sponsored nofollow&quot;</code> e o preço aparece junto da data em que
            foi verificado. As regras completas estão em <Link href="/publicidade">publicidade e parcerias</Link>.
          </p>

          <h2 id="correcoes">Correções</h2>
          <p>
            Erro publicado é erro corrigido no mesmo endereço, com nota indicando o que mudou e quando. Não apagamos
            matéria para esconder engano. Para pedir uma correção, escreva para{' '}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> com o link e o trecho.
          </p>

          <h2>Rede</h2>
          <p>
            O{' '}
            <a href="https://cinerie.com/" rel="noopener">
              Cinerie
            </a>{' '}
            é nosso site irmão, especializado em cinema e séries. Os dados de disponibilidade em streaming publicados
            aqui são apurados pela redação do Cinerie, e estão sempre creditados.
          </p>
        </div>
      </Editorial>
    </>
  );
}
