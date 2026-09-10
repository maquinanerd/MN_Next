import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterForm } from '@mn/ui';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Newsletter',
    description: 'Receba a newsletter do Máquina Nerd no seu e-mail.',
    path: '/newsletter',
  });
}

/**
 * Newsletter. It promises no frequency and no contents — the provider and the editorial
 * format are not decided yet, and the kit forbids inventing either.
 */
export default function NewsletterPage() {
  return (
    <InstitutionalPage
      titulo="Newsletter"
      intro="Receba no seu e-mail uma seleção de notícias de cinema, séries e TV, games, quadrinhos e animes do Máquina Nerd."
    >
      <div className="border border-line p-20 tab:p-28">
        <NewsletterForm endpoint="/api/newsletter" />
      </div>
      <p className="text-13">
        Usamos seu e-mail apenas para enviar a newsletter, com link de cancelamento em toda edição. Detalhes na{' '}
        <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
    </InstitutionalPage>
  );
}
