import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@mn/content/env';
import { KalElContentRepository } from '@mn/content/kalel/repository';

import { correlationId, logger } from '../../../lib/logger';

/**
 * Authenticated media proxy.
 *
 * Kal El serves media from `GET /v1/sites/:siteId/media/:mediaId/file`, which requires
 * the `media.read` scope. The reader's browser must never see that credential, so the
 * bytes are fetched server-side and re-emitted from this origin.
 *
 * Not a general proxy: the only input is a UUID, the upstream URL is built from the
 * configured base URL and site id, and the response type is pinned to the MIME type the
 * CMS recorded. There is no caller-controlled destination, so there is no SSRF surface
 * and no way to turn this into an open image proxy.
 */

export const runtime = 'nodejs';
export const revalidate = 86400;

const idSchema = z.string().uuid();

const IMMUTABLE = 'public, max-age=31536000, immutable';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const cid = correlationId(request.headers);
  const { id } = await ctx.params;

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return new NextResponse('Not found', { status: 404 });

  try {
    serverEnv();
  } catch {
    return new NextResponse('Not configured', { status: 503 });
  }

  const repository = new KalElContentRepository();

  let meta: { mimeType: string; filename: string } | null;
  try {
    meta = await repository.getMedia(parsed.data);
  } catch (err) {
    logger.warn('media.metadata-failed', { correlationId: cid, mediaId: parsed.data, error: String(err) });
    return new NextResponse('Upstream unavailable', { status: 502 });
  }
  if (!meta) return new NextResponse('Not found', { status: 404 });

  // Only raster images are re-served. Anything else - SVG above all - would be active
  // content executing on this origin.
  if (!ALLOWED_TYPES.has(meta.mimeType)) {
    logger.warn('media.type-refused', { correlationId: cid, mediaId: parsed.data, mimeType: meta.mimeType });
    return new NextResponse('Unsupported media type', { status: 415 });
  }

  let upstream: Response;
  try {
    upstream = await repository.mediaBytes(parsed.data, request.signal);
  } catch (err) {
    logger.warn('media.fetch-failed', { correlationId: cid, mediaId: parsed.data, error: String(err) });
    return new NextResponse('Upstream unavailable', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(upstream.status === 404 ? 'Not found' : 'Upstream unavailable', {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      // The CMS-recorded type wins over anything the upstream response claims.
      'content-type': meta.mimeType,
      'cache-control': IMMUTABLE,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
    },
  });
}
