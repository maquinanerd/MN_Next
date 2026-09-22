import { NextResponse } from 'next/server';

import { uploadKeys } from '../../../../lib/legacy-media';
import { mediaIdFor } from '../../../../lib/legacy-media-table';

/**
 * The WordPress image URLs, sent on to the same image in Kal El.
 *
 * Every picture the archive published lived at `/wp-content/uploads/…`, and those URLs are
 * still in Google Images, in other sites' pages and in old shares. The import kept each
 * one, and `data/legacy-media.tsv.gz` records where it went — by exact upload path, month
 * folder included (`pnpm media-redirects:build`). An old URL — the original, a size cut
 * from it, a plugin's `.webp` — is answered with a permanent redirect to `/media/{id}`.
 * A path the table does not hold is a 404: never a picture that may be the wrong one.
 *
 * No CMS call: a lookup in memory. The redirect is cached a week at the edge, the 404 an
 * hour.
 */

export const runtime = 'nodejs';

const MOVED_CACHE = 'public, max-age=86400, s-maxage=604800';
const MISSING_CACHE = 'public, max-age=3600, s-maxage=3600';

export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const keys = uploadKeys(path);
  const id = keys ? mediaIdFor(keys) : null;
  if (!id) return new NextResponse('Not found', { status: 404, headers: { 'cache-control': MISSING_CACHE } });
  // By path alone: behind the proxy, the request's own host is not the public one.
  return new NextResponse(null, { status: 301, headers: { location: `/media/${id}`, 'cache-control': MOVED_CACHE } });
}
