import { NextResponse } from 'next/server';

import { correlationId } from '../../../lib/logger';
import { IMMUTABLE, mediaSource } from '../../../lib/media-proxy';

/**
 * Authenticated media proxy.
 *
 * Kal El serves media from `GET /v1/sites/:siteId/media/:mediaId/file`, which requires
 * the `media.read` scope. The reader's browser must never see that credential, so the
 * bytes are fetched server-side and re-emitted from this origin (`lib/media-proxy.ts`),
 * with the response type pinned to the MIME type the CMS recorded.
 */

export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const source = await mediaSource(id, request.signal, correlationId(request.headers));
  if (source instanceof NextResponse) return source;

  return new NextResponse(source.upstream.body, {
    status: 200,
    headers: {
      // The CMS-recorded type wins over anything the upstream response claims.
      'content-type': source.mimeType,
      'cache-control': IMMUTABLE,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
    },
  });
}
