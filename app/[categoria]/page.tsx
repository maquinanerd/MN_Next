import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { CATEGORY_SLUGS, RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';

import { legacyPath } from '../../lib/legacy-permalink';
import { CategoryView, loadCategory, categoryMetadata } from './view';

/**
 * Editorial listing at `/{categoria}`.
 *
 * ISR at 120 s (docs/08). The catch-all is guarded against reserved first segments so
 * `/busca` can never resolve as a desk named "busca".
 *
 * It is also where the whole WordPress archive lands. The old site published articles at
 * `/{slug}` and — with the category base stripped — category archives at `/{slug}` as
 * well, so 41.318 article URLs and 8.619 archive URLs arrive here looking like desks. A
 * segment that turns out to be an article or a tag is answered with a permanent redirect
 * to its real address instead of a 404. See `lib/legacy-permalink.ts` for why that is a
 * lookup rather than a redirect table.
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
  // Metadata is generated concurrently with the page, so it reaches a legacy permalink
  // before the redirect does. Asking `categoryMetadata` for a desk that does not exist
  // would 404 the request out from under the 301.
  if (await legacyPath(slug)) return { robots: { index: false } };
  return categoryMetadata(slug, 1);
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) notFound();

  const legacy = await legacyPath(slug);
  if (legacy) permanentRedirect(legacy);

  const data = await loadCategory(slug, 1);
  return <CategoryView data={data} page={1} />;
}
