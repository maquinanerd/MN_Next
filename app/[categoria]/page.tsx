import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { EDITORIA_SLUGS, RESERVED_SEGMENTS, safeSlugParam } from '@mn/content';

import { legacyPath } from '../../lib/legacy-permalink';
import { EditoriaPage, editoriaMetadata, loadEditoria } from './view';

/**
 * `/{editoria}`. ISR at 120 s. The catch-all never reads a reserved segment as an
 * editoria (`/busca` is not an editoria named "busca").
 *
 * It is also where the WordPress archive lands: the old site published articles at
 * `/{slug}` and, with the category base stripped, category archives at `/{slug}` too. A
 * segment that turns out to be an article or a tag is answered with a permanent redirect
 * to its real address (`lib/legacy-permalink.ts`).
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
  if (!slug || RESERVED_SEGMENTS.has(slug)) return { title: 'Editoria não encontrada', robots: { index: false } };
  // Metadata is generated concurrently with the page and reaches a legacy permalink
  // before the redirect does; asking for a desk that does not exist would 404 it.
  if (await legacyPath(slug)) return { robots: { index: false } };
  return editoriaMetadata(slug, 1);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const slug = safeSlugParam(categoria);
  if (!slug || RESERVED_SEGMENTS.has(slug)) notFound();

  const legacy = await legacyPath(slug);
  if (legacy) permanentRedirect(legacy);

  const view = await loadEditoria(slug, 1);
  return <EditoriaPage view={view} page={1} />;
}
