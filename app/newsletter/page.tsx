import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, Editorial, NewsletterForm } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata } from '@mn/seo';

import { seoContext } from '../../lib/seo-context';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Newsletter',
    description: 'A semana nerd em 5 minutos: cinema, séries, quadrinhos e games, toda sexta no seu e-mail.',
    path: '/newsletter',
  });
}

export default function NewsletterPage() {
  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Newsletter' }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <h1 className="mn-cathead__title">A semana nerd em 5 minutos</h1>
          <p className="mn-cathead__desc">
            Toda sexta-feira, o que realmente importou em cinema, séries, quadrinhos, games e animes. Sem clickbait, sem
            corrente de e-mail, e com um link de cancelamento em toda edição.
          </p>
        </header>

        <div className="mn-section">
          <div className="mn-newsletter">
            <span className="mn-newsletter__eyebrow">Inscrição</span>
            <h2 className="mn-newsletter__title">Receber a newsletter</h2>
            <NewsletterForm />
            <p className="mn-wheretowatch__intro" style={{ marginBottom: 0 }}>
              Usamos seu e-mail apenas para enviar esta newsletter. Detalhes na{' '}
              <Link href="/politica-de-privacidade">política de privacidade</Link>.
            </p>
          </div>
        </div>
      </Editorial>
    </>
  );
}
