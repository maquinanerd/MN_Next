import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@mn/content';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Anuncie',
    description: 'Formatos de publicidade e regras de transparência do Máquina Nerd.',
    path: '/anuncie',
  });
}

export default function AdvertisePage() {
  return (
    <InstitutionalPage
      titulo="Anuncie no Máquina Nerd"
      intro="Formatos, posições e as regras que valem para todo anúncio."
    >
      <h2>Formatos</h2>
      <p>
        Os anúncios do site são ofertas da Shopee, escolhidas pelo OpaPreço Ads a partir do assunto da matéria, sempre
        com o aviso “Link de afiliado”. Ficam em posições fixas:
      </p>
      <ul>
        <li>abaixo do título e da linha fina da matéria;</li>
        <li>duas dentro do texto, entre parágrafos, com pelo menos três parágrafos entre elas;</li>
        <li>uma no fim da matéria, antes das notícias relacionadas;</li>
        <li>uma fixa na lateral das listas de notícias, só no computador.</li>
      </ul>
      <p>
        Todo espaço é reservado antes de o anúncio carregar, então o anúncio que chega não empurra o texto. Quando não
        há oferta para a página, o espaço reservado fecha.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>Intersticial sobre o conteúdo, incluindo pop-up de newsletter.</li>
        <li>Anúncio acima do título, ou logo depois de uma imagem.</li>
        <li>Mais de quatro anúncios numa matéria, ou mais de dois no meio do texto.</li>
        <li>Publicidade em matérias sobre morte, acidente, tragédia ou processo judicial.</li>
        <li>Preço, desconto ou estoque sem dado real, ou contagem regressiva para pressionar a compra.</li>
      </ul>

      <h2>Conteúdo patrocinado</h2>
      <p>
        Conteúdo de parceiros aparece sempre sob o rótulo “Conteúdo patrocinado”, com “Parceiro · Patrocinado” em cada
        item, e não é escrito pela redação. Links de compra seguem a{' '}
        <Link href="/politica-de-afiliados">política de afiliados</Link>.
      </p>

      <h2>Contato comercial</h2>
      <p>
        Propostas e mídia kit: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
