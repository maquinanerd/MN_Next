import type { Metadata } from 'next';
import { SITE } from '@mn/content';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Acessibilidade',
    description: 'O compromisso de acessibilidade do Máquina Nerd e como relatar um problema.',
    path: '/acessibilidade',
  });
}

/** States what the site does, each item enforced by `tests/e2e/a11y.spec.ts`. */
export default function AccessibilityPage() {
  return (
    <InstitutionalPage titulo="Acessibilidade" intro="O Máquina Nerd segue as diretrizes WCAG 2.1, nível AA.">
      <h2>O que o site faz</h2>
      <ul>
        <li>Todo texto tem contraste mínimo de 4,5:1 com o fundo.</li>
        <li>Todas as páginas podem ser navegadas pelo teclado, com o foco sempre visível.</li>
        <li>O link “Ir para o conteúdo”, no início de cada página, pula o menu.</li>
        <li>Imagens informativas têm descrição; imagens decorativas são ignoradas pelos leitores de tela.</li>
        <li>Controles de toque têm pelo menos 40px de altura no celular.</li>
        <li>Quem pede menos movimento ao sistema não vê as animações do menu.</li>
        <li>Vídeos de terceiros só carregam quando você escolhe assistir.</li>
      </ul>

      <h2>Encontrou um problema?</h2>
      <p>
        Escreva para <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> com o endereço da página e o que
        aconteceu. Toda mensagem sobre acessibilidade é respondida.
      </p>
    </InstitutionalPage>
  );
}
