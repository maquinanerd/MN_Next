import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EDITORIA_SLUGS, RESERVED_SEGMENTS, isEditoriaSlug, safeSlugParam } from '@mn/content';

import { EditoriaPage, editoriaMetadata, loadEditoria } from './view';

/**
 * `/{editoria}`. ISR at 120 s. The catch-all never reads a reserved segment as an
 * editoria (`/busca` is not an editoria named "busca").
 *
 * Only an editoria. The WordPress archive — articles and category archives, both at
 * `/{slug}` on the old site — no longer lands here: `middleware.ts` sends those to
 * `/legado/[slug]`, which renders on request. A redirect thrown from this cached page
 * came back from the cache as a 308 with no `Location`, for every one of them.
 */
export const revalidate = 120;

type Params = { categoria: string };

/** The seven editorias are fixed, so they are always prerendered. */
export function generateStaticParams(): Params[] {
  return EDITORIA_SLUGS.map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug) || !isEditoriaSlug(slug)) {
    return { title: 'Editoria não encontrada', robots: { index: false } };
  }
  return editoriaMetadata(slug, 1);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug) || !isEditoriaSlug(slug)) notFound();

  const view = await loadEditoria(slug, 1);
  return <EditoriaPage view={view} page={1} />;
}
