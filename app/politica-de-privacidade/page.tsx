import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@mn/content';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Política de privacidade',
    description: 'Quais dados o Máquina Nerd coleta, com que finalidade e como exercer seus direitos sob a LGPD.',
    path: '/politica-de-privacidade',
  });
}

export default function PrivacyPage() {
  return (
    <InstitutionalPage
      titulo="Política de privacidade"
      intro="Como o Máquina Nerd trata dados pessoais, conforme a Lei 13.709/2018 (LGPD)."
    >
      <h2>O que é coletado sem consentimento</h2>
      <p>
        O necessário para o site funcionar: o cookie que guarda a sua escolha no aviso de privacidade, que não
        identifica você e não é compartilhado. Os anúncios (ofertas da Shopee, pelo OpaPreço Ads) são escolhidos pelo
        assunto da página, não por quem lê: o pedido de anúncio vai sem cookie e leva o endereço e o título da página, a
        editoria, as tags, o número da matéria e o tamanho da tela. A lista completa está em{' '}
        <Link href="/cookies">cookies</Link>.
      </p>

      <h2>O que depende do seu consentimento</h2>
      <ul>
        <li>
          Medição de audiência com o Google Analytics, que recebe as páginas visitadas, a origem da visita, o tipo de
          aparelho, a cidade aproximada (o endereço IP não é armazenado), a rolagem até o fim da página, os cliques em
          links para outros sites e os termos buscados na busca do site; e métricas de desempenho agregadas.
        </li>
        <li>Conteúdos incorporados de terceiros, como vídeos do YouTube, que só carregam depois de um clique.</li>
      </ul>
      <p>
        Enquanto você não aceitar, nada disso é executado. Recusar não limita o acesso a nenhuma matéria nem muda os
        anúncios, que nunca usam dados seus.
      </p>

      <h2>Newsletter</h2>
      <p>
        O e-mail informado é usado apenas para o envio da newsletter, com link de cancelamento em toda edição. O
        cancelamento remove o endereço da base.
      </p>

      <h2>Links de afiliados</h2>
      <p>
        Links de compra podem conter identificadores de afiliado. A partir da loja, vale a política de privacidade da
        própria loja.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados, e
        revogar o consentimento a qualquer momento. Escreva para{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
