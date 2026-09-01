import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { ArticleGrid, Breadcrumbs, Editorial, EmptyState, Pagination, SectionHeading } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata, personPageNode, absolute } from '@mn/seo';

import { repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Author page.
 *
 * Indexable: an author archive is an E-E-A-T surface and Google reads it to attribute
 * expertise to the byline. Its `ProfilePage` node links the person to the organisation.
 */
export const revalidate = 300;

type Params = { slug: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const { page } = await searchParams;
  const slug = safeSlugParam(raw);
  if (!slug) return { title: 'Autor não encontrado', robots: { index: false } };
  const result = await repo()
    .getAuthor(slug, 1)
    .catch(() => null);
  if (!result) return { title: 'Autor não encontrado', robots: { index: false } };
  return listingMetadata(seoContext(), {
    title: result.author.name,
    description: result.author.bio ?? `Matérias assinadas por ${result.author.name} no Máquina Nerd.`,
    path: `/autor/${slug}`,
    page: Number(page ?? 1) || 1,
    pagination: 'query',
  });
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug: raw } = await params;
  const { page: rawPage } = await searchParams;
  const page = Number(rawPage ?? 1) || 1;
  const slug = safeSlugParam(raw);
  if (!slug) notFound();

  const result = await repo().getAuthor(slug, page);
  if (!result) notFound();

  const ctx = seoContext();
  const url = absolute(ctx, `/autor/${slug}`);
  const crumbs = [{ label: 'Home', href: '/' }, { label: result.author.name }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [personPageNode(ctx, result.author, url), breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />

        <header className="mn-cathead">
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              className="mn-authorbox__avatar"
              style={{ background: result.author.avatarColor, width: 64, height: 64, fontSize: 20 }}
              aria-hidden="true"
            >
              {result.author.initials}
            </span>
            <div>
              <h1 className="mn-cathead__title" style={{ fontSize: 'var(--fs-h1)' }}>
                {result.author.name}
              </h1>
              {result.author.role ? <p className="mn-stat__label">{result.author.role}</p> : null}
            </div>
          </div>
          {result.author.bio ? <p className="mn-cathead__desc">{result.author.bio}</p> : null}
        </header>

        <div className="mn-section">
          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhuma matéria publicada ainda"
              description={`${result.author.name} ainda não tem matérias publicadas neste portal.`}
              action={{ label: 'Ver a home', href: '/' }}
            />
          ) : (
            <>
              <SectionHeading label="Últimas matérias" />
              <ArticleGrid articles={result.items} columns={3} showExcerpt />
              <Pagination
                page={page}
                totalPages={result.totalPages}
                hasNext={result.hasNext}
                hrefFor={(n) => (n === 1 ? `/autor/${slug}` : `/autor/${slug}?page=${n}`)}
              />
            </>
          )}
        </div>
      </Editorial>
    </>
  );
}
