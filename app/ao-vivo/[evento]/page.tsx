import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { AdSlot, AD_SLOTS, Breadcrumbs, Editorial, LiveCoverage, Shell } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, liveBlogNode, listingMetadata, absolute } from '@mn/seo';

import { repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Live coverage at `/ao-vivo/{evento}`.
 *
 * Static shell plus client polling, deliberately: a 15-second `revalidate` on the whole
 * route would rebuild the page - ads, related, everything - four times a minute for one
 * new paragraph (docs/03, docs/08). The shell is ISR at 120 s; the entries arrive from
 * `/api/live/[slug]`.
 */
export const revalidate = 120;

type Params = { evento: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { evento } = await params;
  const slug = safeSlugParam(evento);
  if (!slug) return { title: 'Cobertura não encontrada', robots: { index: false } };
  const event = await repo()
    .getLiveEvent(slug)
    .catch(() => null);
  if (!event) return { title: 'Cobertura não encontrada', robots: { index: false } };
  return listingMetadata(seoContext(), {
    title: event.title,
    description: `Cobertura em tempo real: ${event.title}.`,
    path: `/ao-vivo/${slug}`,
  });
}

export default async function LiveEventPage({ params }: { params: Promise<Params> }) {
  const { evento } = await params;
  const slug = safeSlugParam(evento);
  if (!slug) notFound();
  const event = await repo().getLiveEvent(slug);
  if (!event) notFound();

  const ctx = seoContext();
  const url = absolute(ctx, `/ao-vivo/${slug}`);
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Ao vivo' }, { label: event.title }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [liveBlogNode(ctx, event, url), breadcrumbNode(ctx, crumbs)])} />

      <div className="mn-urgent__strip">
        <Shell>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mn-live-badge">
              <span className="mn-live-badge__pulse" aria-hidden="true" />
              {event.status === 'live' ? 'Ao vivo' : 'Encerrada'}
            </span>
            <span>
              {event.entries.length} {event.entries.length === 1 ? 'atualização' : 'atualizações'}
            </span>
          </div>
        </Shell>
      </div>

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <h1 className="mn-article__title">{event.title}</h1>

        <div className="mn-article">
          <section aria-label="Minuto a minuto">
            <LiveCoverage slug={slug} initialEntries={event.entries} />
          </section>
          <aside className="mn-article__aside" aria-label="Complementos">
            <AdSlot
              id="ad-live-sidebar"
              {...AD_SLOTS.sidebar}
              sticky
              targeting={{ brand: 'mn', template: 'ao-vivo' }}
            />
          </aside>
        </div>
      </Editorial>
    </>
  );
}
