import { NextResponse } from 'next/server';
import { parseRenditionFile } from '@mn/seo';

import { correlationId, logger } from '../../../../lib/logger';
import { IMMUTABLE, mediaSource } from '../../../../lib/media-proxy';
import {
  DOWNLOAD_TIMEOUT_MS,
  MAX_INPUT_BYTES,
  createQueue,
  readCapped,
  renderRendition,
} from '../../../../lib/renditions';

/**
 * One rendition of a CMS image as a JPEG: a crop of a cover — `16x9-v1.jpg`, `4x3-v1.jpg`,
 * `1x1-v1.jpg`, 1200 px wide — or `social-v1.jpg`, a share image re-encoded in its own
 * proportions (`packages/seo/src/cover.ts`).
 *
 * The three aspect ratios are what Google asks an Article image for, and the 16:9 one is the
 * `og:image`. A JPEG, whatever the original: the newsroom uploads AVIF, which Facebook and
 * WhatsApp do not preview. The crop follows the most salient region (`attention`), so a face
 * at the edge of a wide still is not cut away.
 *
 * Rendered on request — a route handler that reads the request is dynamic — and then cached
 * for a year by the CDN and the browser: the URL names the source by id and the rendering by
 * version, and neither ever changes under it. Every miss costs a download and a decode, so
 * the route bounds what one can cost, how long its download may hold a slot and how many run
 * at once, and refuses the query strings that would turn one cached URL into as many misses
 * as someone cares to ask for (lib/renditions.ts).
 */

export const runtime = 'nodejs';

/** Two drawn at a time, thirty-two waiting; past that a request is told to come back. */
const queue = createQueue(2, 32);

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string; variant: string }> },
): Promise<Response> {
  const cid = correlationId(request.headers);
  const { id, variant } = await ctx.params;
  const rendition = parseRenditionFile(variant);
  if (!rendition) return new NextResponse('Not found', { status: 404 });

  // Nothing the route draws depends on a query string, and the CDN keys its cache on one.
  // Sent on by path alone: behind the proxy, the request's own host is not the public one.
  const url = new URL(request.url);
  if (url.search) return new NextResponse(null, { status: 301, headers: { location: url.pathname } });

  const drawn = await queue.run(async (): Promise<Response> => {
    // A CMS that stops answering gives the slot back instead of holding it for as long as
    // the reader waits.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]);
    const source = await mediaSource(id, signal, cid);
    if (source instanceof NextResponse) return source;

    const declared = Number(source.upstream.headers.get('content-length') ?? '0');
    if (declared > MAX_INPUT_BYTES) {
      await source.upstream.body.cancel();
      return new NextResponse('Image too large', { status: 422 });
    }
    let input: Buffer | null;
    try {
      input = await readCapped(source.upstream.body, MAX_INPUT_BYTES);
    } catch (err) {
      // The reader went away, or the CMS did, halfway through the download.
      if (request.signal.aborted) return new NextResponse(null, { status: 499 });
      logger.warn('media.fetch-failed', { correlationId: cid, mediaId: id, error: String(err) });
      return new NextResponse('Upstream unavailable', { status: 502 });
    }
    if (!input) return new NextResponse('Image too large', { status: 422 });

    let jpeg: Buffer;
    try {
      jpeg = await renderRendition(input, rendition);
    } catch (err) {
      logger.warn('media.variant-failed', { correlationId: cid, mediaId: id, variant: rendition, error: String(err) });
      return new NextResponse('Unprocessable image', { status: 422 });
    }

    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'content-length': String(jpeg.byteLength),
        'cache-control': IMMUTABLE,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  }, request.signal);

  if (drawn) return drawn;
  if (request.signal.aborted) return new NextResponse(null, { status: 499 });
  return new NextResponse('Busy', { status: 503, headers: { 'retry-after': '5', 'cache-control': 'no-store' } });
}
