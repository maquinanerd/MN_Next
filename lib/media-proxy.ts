import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@mn/content/env';
import { KalElContentRepository } from '@mn/content/kalel/repository';

import { logger } from './logger';

/**
 * The shared half of the media routes: one CMS image, fetched with the service token.
 *
 * Not a general proxy: the only input is a UUID, the upstream URL is built from the
 * configured base URL and site id, and only raster types the CMS recorded are served.
 * There is no caller-controlled destination, so there is no SSRF surface.
 */

export const IMMUTABLE = 'public, max-age=31536000, immutable';

const idSchema = z.string().uuid();

/** Raster only: anything else — SVG above all — would be active content on this origin. */
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export interface MediaSource {
  mimeType: string;
  upstream: Response & { body: ReadableStream<Uint8Array> };
}

/** The image's bytes and recorded type, or the response that says why not. */
export async function mediaSource(id: string, signal: AbortSignal, cid: string): Promise<MediaSource | NextResponse> {
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

  if (!RASTER_TYPES.has(meta.mimeType)) {
    logger.warn('media.type-refused', { correlationId: cid, mediaId: parsed.data, mimeType: meta.mimeType });
    return new NextResponse('Unsupported media type', { status: 415 });
  }

  let upstream: Response;
  try {
    upstream = await repository.mediaBytes(parsed.data, signal);
  } catch (err) {
    logger.warn('media.fetch-failed', { correlationId: cid, mediaId: parsed.data, error: String(err) });
    return new NextResponse('Upstream unavailable', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(upstream.status === 404 ? 'Not found' : 'Upstream unavailable', {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  return { mimeType: meta.mimeType, upstream: upstream as MediaSource['upstream'] };
}
