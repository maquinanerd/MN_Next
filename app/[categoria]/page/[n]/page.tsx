import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RESERVED_SEGMENTS, isEditoriaSlug, safeSlugParam } from '@mn/content';

import { parsePage } from '../../../../lib/content';
import { EditoriaPage, editoriaMetadata, loadEditoria } from '../../view';

/**
 * `/{editoria}/page/{n}`. Page 1 redirects to the unpaginated URL: two addresses for one
 * listing is duplicate content, and the canonical is the short one.
 */
export const revalidate = 120;

type Params = { categoria: string; n: string };

/**
 * None at build time, every page on its first request — and then cached like page 1.
 * Without this function the route is rendered on every request whatever `revalidate`
 * says: until 2026-11-27 every `/{editoria}/page/{n}` answered `private, no-store`.
 */
export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug) || !isEditoriaSlug(slug)) {
    return { title: 'Editoria não encontrada', robots: { index: false } };
  }
  return editoriaMetadata(slug, parsePage(n));
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { categoria, n } = await params;
  const slug = safeSlugParam(categoria);
  // The same rule as page 1 (`../page.tsx`): only an editoria has pages. Anything else is a
  // 404 before any CMS read — cached now, it would otherwise be a CMS round per junk path.
  if (!slug || RESERVED_SEGMENTS.has(slug) || !isEditoriaSlug(slug)) notFound();
  const page = parsePage(n);
  // Page 1 is the listing itself, and `middleware.ts` sends it there: redirected from this
  // cached page, the answer would come back from the cache with no `Location`.
  if (page === 1) notFound();
  const view = await loadEditoria(slug, page);
  return <EditoriaPage view={view} page={page} />;
}
