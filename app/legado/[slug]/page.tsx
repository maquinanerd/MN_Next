import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { safeSlugParam } from '@mn/content';

import { legacyPath } from '../../../lib/legacy-permalink';

/**
 * A WordPress permalink — `/{slug}` — on its way to where the story lives now.
 *
 * `middleware.ts` rewrites here every single-segment path that is neither an editoria nor
 * a route of this site, so the address the reader and the crawler see is still the old
 * one. Rendered on request and never cached: a redirect thrown from a page Next caches
 * comes back from that cache as a `308` with no `Location` — a redirect to nowhere for a
 * crawler — which is what every one of the 41.316 permalinks answered from 2026-09-16 to
 * 2026-09-21, when this lookup still lived in the cached `/[categoria]` page.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function LegacyPermalink({ params }: { params: Promise<{ slug: string }> }) {
  const slug = safeSlugParam((await params).slug);
  const path = slug ? await legacyPath(slug) : null;
  if (!path) notFound();
  permanentRedirect(path);
}
