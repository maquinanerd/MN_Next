import type { Metadata } from 'next';
import { Breadcrumbs, Editorial } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata } from '@mn/seo';
import { SITE } from '@mn/content';

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
  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Política de privacidade' }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">Política de privacidade</h1>
          <p className="mn-cathead__desc">
            Este documento descreve o tratamento de dados pessoais no Máquina Nerd, conforme a Lei 13.709/2018 (LGPD).
          </p>
        </header>

        <div className="mn-prose mn-section">
          <h2>O que é coletado sem consentimento</h2>
          <p>
            Apenas o necessário para o site funcionar: o cookie de preferência de tema e, quando você usa a
            pré-visualização editorial, o cookie de sessão correspondente. Nenhum dos dois identifica você e nenhum é
            compartilhado.
          </p>

          <h2>O que depende do seu consentimento</h2>
          <ul>
            <li>Medição de audiência e métricas de desempenho (Core Web Vitals) agregadas por template e editoria.</li>
            <li>Publicidade personalizada servida pelo Google Ad Manager.</li>
            <li>
              Conteúdos incorporados de terceiros (YouTube, X, Instagram, TikTok), que só carregam após um clique.
            </li>
          </ul>
          <p>Enquanto você não aceitar, nada disso é executado. Recusar não limita o acesso a nenhuma matéria.</p>

          <h2>Métricas de desempenho</h2>
          <p>
            Quando autorizadas, enviamos o nome da métrica, o valor, o tipo de template e a editoria. Não enviamos a URL
            completa, parâmetros de busca, identificador de usuário ou endereço IP para essa finalidade.
          </p>

          <h2>Newsletter</h2>
          <p>
            O e-mail informado é usado exclusivamente para o envio da newsletter, com link de cancelamento em toda
            edição. O cancelamento remove o endereço da base.
          </p>

          <h2>Links de afiliados</h2>
          <p>
            Links de compra podem conter identificadores de afiliado do lojista. O redirecionamento é feito pelo próprio
            lojista, e a política de privacidade aplicável a partir dali é a dele.
          </p>

          <h2>Seus direitos</h2>
          <p>
            Você pode solicitar confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados,
            além de revogar o consentimento a qualquer momento. Escreva para{' '}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>

          <h2>Alterações</h2>
          <p>Mudanças relevantes nesta política são anunciadas no site antes de entrarem em vigor.</p>
        </div>
      </Editorial>
    </>
  );
}
