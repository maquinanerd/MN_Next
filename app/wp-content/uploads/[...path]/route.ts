import { NextResponse } from 'next/server';
import { serverEnv } from '@mn/content/env';
import { KalElContentRepository } from '@mn/content/kalel/repository';

import { legacyUploadNames } from '../../../../lib/legacy-media';
import { correlationId, logger } from '../../../../lib/logger';

/**
 * The WordPress image URLs, sent on to the same image in Kal El.
 *
 * Every picture the archive published lived at `/wp-content/uploads/…`, and those URLs are
 * still in Google Images, in other sites' pages and in old shares. The import kept each
 * picture — under its original file name — so an old URL is answered with a permanent
 * redirect to `/media/{id}`, found by name (`lib/legacy-media.ts`). A name that matches no
 * image, or more than one, is a 404: never a picture that may be the wrong one.
 *
 * One CMS search per URL, and then the CDN answers: the redirect is cached for a week at
 * the edge, the 404 for an hour.
 */

export const runtime = 'nodejs';

const MOVED_CACHE = 'public, max-age=86400, s-maxage=604800';
const MISSING_CACHE = 'public, max-age=3600, s-maxage=3600';

function missing(): Response {
  return new NextResponse('Not found', { status: 404, headers: { 'cache-control': MISSING_CACHE } });
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const wanted = legacyUploadNames(path);
  if (!wanted) return missing();

  let source: string;
  try {
    source = serverEnv().CONTENT_SOURCE;
  } catch {
    return new NextResponse('Not configured', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  // The fixture has no archive behind it.
  if (source !== 'kalel') return missing();

  let id: string | null;
  try {
    id = await new KalElContentRepository().findMediaIdByFilename(wanted.stem, wanted.names);
  } catch (err) {
    logger.warn('legacy-upload.lookup-failed', { correlationId: correlationId(request.headers), error: String(err) });
    return new NextResponse('Upstream unavailable', { status: 502, headers: { 'cache-control': 'no-store' } });
  }
  if (!id) return missing();

  // By path alone: behind the proxy, the request's own host is not the public one.
  return new NextResponse(null, { status: 301, headers: { location: `/media/${id}`, 'cache-control': MOVED_CACHE } });
}
