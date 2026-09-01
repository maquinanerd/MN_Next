import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { safeSlugParam } from '@mn/content';
import { ArticleGrid, Breadcrumbs, Editorial, EmptyState, Pagination, SectionHeading } from '@mn/ui';
import { JsonLd, breadcrumbNode, buildGraph, listingMetadata, noindexMetadata } from '@mn/seo';

import { repo } from '../../../lib/content';
import { seoContext } from '../../../lib/seo-context';

/**
 * Tag archive.
 *
 * Page 1 is indexable - a tag is a real topic hub. Paginated tag pages are
 * `noindex, follow`: they are thin, near-duplicate slices that dilute the hub without
 * adding anything a crawler needs (docs/06).
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
  const { page: rawPage } = await searchParams;
  const page = Number(rawPage ?? 1) || 1;
  const slug = safeSlugParam(raw);
  const ctx = seoContext();
  if (!slug) return { title: 'Tag não encontrada', robots: { index: false } };
  const result = await repo()
    .getTag(slug, 1)
    .catch(() => null);
  if (!result) return { title: 'Tag não encontrada', robots: { index: false } };

  if (page > 1) {
    return noindexMetadata(
      ctx,
      `${result.tag.name} — página ${page}`,
      `Matérias sobre ${result.tag.name}.`,
      `/tag/${slug}?page=${page}`,
    );
  }
  return listingMetadata(ctx, {
    title: result.tag.name,
    description: `Todas as matérias do Máquina Nerd sobre ${result.tag.name}.`,
    path: `/tag/${slug}`,
  });
}

export default async function TagPage({
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

  const result = await repo().getTag(slug, page);
  if (!result) notFound();

  const ctx = seoContext();
  const crumbs = [{ label: 'Home', href: '/' }, { label: result.tag.name }];

  return (
    <>
      <JsonLd graph={buildGraph(ctx, [breadcrumbNode(ctx, crumbs)])} />

      <Editorial>
        <Breadcrumbs items={crumbs} />
        <header className="mn-cathead">
          <p className="mn-sectionheading__label">Tag</p>
          <h1 className="mn-cathead__title">{result.tag.name}</h1>
        </header>

        <div className="mn-section">
          {result.items.length === 0 ? (
            <EmptyState
              title="Nenhuma matéria com esta tag"
              description="Talvez o assunto ainda não tenha sido coberto, ou a tag tenha sido renomeada."
              action={{ label: 'Buscar no site', href: '/busca' }}
            />
          ) : (
            <>
              <SectionHeading label="Matérias" />
              <ArticleGrid articles={result.items} columns={3} showExcerpt />
              <Pagination
                page={page}
                totalPages={result.totalPages}
                hasNext={result.hasNext}
                hrefFor={(n) => (n === 1 ? `/tag/${slug}` : `/tag/${slug}?page=${n}`)}
              />
            </>
          )}
        </div>
      </Editorial>
    </>
  );
}
