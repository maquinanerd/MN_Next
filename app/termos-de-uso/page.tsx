import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@mn/content';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Termos de uso',
    description: 'As condições de uso do Máquina Nerd.',
    path: '/termos-de-uso',
  });
}

/**
 * The operator's legal counsel owns the final text of this page; it is listed as an
 * external pending item in docs/migration/FINAL-VERIFICATION.md. What is here describes
 * only how the site actually works.
 */
export default function TermsPage() {
  return (
    <InstitutionalPage titulo="Termos de uso">
      <h2>Conteúdo</h2>
      <p>
        As matérias, fotos e vídeos publicados no Máquina Nerd pertencem aos seus autores e titulares. Você pode
        compartilhar o link de qualquer matéria; a reprodução do texto ou das imagens depende de autorização.
      </p>

      <h2>Links externos e ofertas</h2>
      <p>
        O Máquina Nerd não se responsabiliza pelo conteúdo de sites externos. Links de compra levam a lojas parceiras,
        cujas condições valem a partir dali — veja a <Link href="/politica-de-afiliados">política de afiliados</Link>.
      </p>

      <h2>Dados pessoais</h2>
      <p>
        O tratamento de dados segue a <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>

      <h2>Contato</h2>
      <p>
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
      </p>
    </InstitutionalPage>
  );
}
