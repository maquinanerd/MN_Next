import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';

import { CategoryView, categoryMetadata, loadCategory } from '../../view';
import { parsePage } from '../../../../lib/content';

/**
 * `/{categoria}/page/{n}`.
 *
 * Page 1 redirects to the unpaginated URL: two addresses for the same listing is
 * duplicate content, and the canonical has to be the short one.
 */
export const revalidate = 120;

type Params = { categoria: string; n: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) return { title: 'Editoria não encontrada', robots: { index: false } };
  return categoryMetadata(slug, parsePage(n));
}

export default async function CategoryPagedPage({ params }: { params: Promise<Params> }) {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) notFound();
  const page = parsePage(n);
  if (page === 1) redirect(`/${slug}`);
  const data = await loadCategory(slug, page);
  return <CategoryView data={data} page={page} />;
}
