import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CATEGORY_SLUGS, RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';

import { CategoryView, loadCategory, categoryMetadata } from './view';

/**
 * Editorial listing at `/{categoria}`.
 *
 * ISR at 120 s (docs/08). The catch-all is guarded against reserved first segments so
 * `/busca` can never resolve as a desk named "busca".
 */
export const revalidate = 120;

type Params = { categoria: string };

/** The five desks are a fixed editorial map, so they are always prerendered. */
export function generateStaticParams(): Params[] {
  return CATEGORY_SLUGS.map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) return { title: 'Editoria não encontrada', robots: { index: false } };
  return categoryMetadata(slug, 1);
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) notFound();
  const data = await loadCategory(slug, 1);
  return <CategoryView data={data} page={1} />;
}
