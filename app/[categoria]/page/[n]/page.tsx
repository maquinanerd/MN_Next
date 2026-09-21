import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';

import { parsePage } from '../../../../lib/content';
import { EditoriaPage, editoriaMetadata, loadEditoria } from '../../view';

/**
 * `/{editoria}/page/{n}`. Page 1 redirects to the unpaginated URL: two addresses for one
 * listing is duplicate content, and the canonical is the short one.
 */
export const revalidate = 120;

type Params = { categoria: string; n: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) return { title: 'Editoria não encontrada', robots: { index: false } };
  return editoriaMetadata(slug, parsePage(n));
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) notFound();
  const page = parsePage(n);
  // Page 1 is the listing itself, and `middleware.ts` sends it there: redirected from this
  // cached page, the answer would come back from the cache with no `Location`.
  if (page === 1) notFound();
  const view = await loadEditoria(slug, page);
  return <EditoriaPage view={view} page={page} />;
}
