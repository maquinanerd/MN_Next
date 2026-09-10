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
      <ul>
        <li>300×250 na coluna lateral da abertura da home e das editorias.</li>
        <li>300×600 fixo na lateral das listas de notícias e das páginas de oferta.</li>
        <li>728×90 dentro das matérias, sempre entre dois parágrafos, e na lista da home a cada três notícias.</li>
        <li>970×250 no meio da home.</li>
      </ul>
      <p>
        Todo espaço é reservado antes de o anúncio carregar, então nenhum anúncio empurra o texto que o leitor está
        lendo.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>Intersticial sobre o conteúdo, incluindo pop-up de newsletter.</li>
        <li>Anúncio entre o título e o primeiro parágrafo, ou logo depois de uma imagem.</li>
        <li>Mais de dois anúncios no meio de uma matéria.</li>
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
