import type { Metadata } from 'next';
import { Breadcrumbs, Editorial } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata } from '@mn/seo';
import { SITE } from '@mn/content';

import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Publicidade e parcerias',
    description: 'Formatos, regras de transparência e política de afiliados do Máquina Nerd.',
    path: '/publicidade',
  });
}

export default function AdvertisingPage() {
  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Publicidade' }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Publicidade e parcerias</h1>
        </header>

        <div className="mn-prose mn-section">
          <h2>Formatos</h2>
          <p>
            Trabalhamos com quatro posições fixas: leaderboard (970×90, 728×90, 320×50), sidebar sticky (300×600,
            300×250), meio de artigo (728×90, 336×280) e âncora mobile (320×50). Todas reservam espaço antes de
            carregar, então o anúncio nunca empurra o texto que o leitor está lendo.
          </p>

          <h2>O que não fazemos</h2>
          <ul>
            <li>Intersticial sobre o conteúdo na entrada, incluindo pop-up de newsletter.</li>
            <li>Anúncio entre o título e o primeiro parágrafo.</li>
            <li>Publicidade em matérias sobre morte, acidente, tragédia ou processo judicial.</li>
            <li>Mais de três inserções de meio de artigo por matéria.</li>
          </ul>

          <h2 id="afiliados">Política de afiliados</h2>
          <p>
            Algumas matérias contêm links de afiliados. Quando uma compra é feita por esses links, o Máquina Nerd pode
            receber comissão do lojista — sem qualquer alteração no valor pago por você.
          </p>
          <ul>
            <li>
              Todo link de compra usa <code>rel=&quot;sponsored nofollow&quot;</code>.
            </li>
            <li>Todo preço vem acompanhado da data em que foi verificado.</li>
            <li>O selo de conteúdo comercial fica acima do título e não pode ser fechado.</li>
            <li>A comissão não influencia nota, veredito ou posição em comparativo.</li>
          </ul>

          <h2>Publieditorial</h2>
          <p>
            Conteúdo produzido em parceria comercial é identificado como publieditorial, traz o nome do anunciante e não
            é escrito pela redação. Campanhas pagas de terceiros são publicadas sob <code>/ofertas</code> e não são
            indexadas.
          </p>

          <h2>Contato comercial</h2>
          <p>
            Propostas e mídia kit: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </div>
      </Editorial>
    </>
  );
}
