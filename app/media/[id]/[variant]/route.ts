import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { COVER_VARIANTS, SOCIAL_WIDTH, parseRenditionFile, type Rendition } from '@mn/seo';

import { correlationId, logger } from '../../../../lib/logger';
import { IMMUTABLE, mediaSource } from '../../../../lib/media-proxy';

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
 * the route bounds what one can cost and how many run at once, and refuses the query strings
 * that would turn one cached URL into as many misses as someone cares to ask for.
 */

export const runtime = 'nodejs';

/** A decompression bomb stops here, before it reaches memory. 40 megapixels is past any photo. */
const MAX_INPUT_PIXELS = 40_000_000;
/** And an original this large is not a photo either; it is not read past this. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Renditions drawn at the same time; the rest wait their turn. */
const MAX_CONCURRENT = 2;
/** Past this many waiting, a request is told to come back rather than queued. */
const MAX_WAITING = 32;

// One libvips thread per image and no operation cache: a crop is drawn once and then served
// by the CDN, and the portal shares its machine with the CMS.
sharp.concurrency(1);
sharp.cache(false);

let running = 0;
const waiting: (() => void)[] = [];

/** Runs `work` when a slot is free; null when the queue is already full. */
async function inTurn<T>(work: () => Promise<T>): Promise<T | null> {
  if (running >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_WAITING) return null;
    // The slot is handed over by the one that frees it, so `running` never overshoots.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    running += 1;
  }
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }
}

/** The body, read up to `max` bytes; null past it. */
async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Buffer | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

function render(input: Buffer, rendition: Rendition): Promise<Buffer> {
  // `truncated`, not the default `warning`: a JPEG from the old archive often ends early and
  // still opens everywhere, and a crop must not be the one place it fails.
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'truncated' }).rotate();
  const sized =
    rendition === 'social'
      ? image.resize(SOCIAL_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
      : image.resize(COVER_VARIANTS[rendition].width, COVER_VARIANTS[rendition].height, {
          fit: 'cover',
          position: sharp.strategy.attention,
        });
  return (
    sized
      // A transparent PNG has no background of its own, and JPEG has no transparency.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  );
}

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

  const drawn = await inTurn(async (): Promise<Response> => {
    const source = await mediaSource(id, request.signal, cid);
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
      jpeg = await render(input, rendition);
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
  });

  if (!drawn) {
    return new NextResponse('Busy', { status: 503, headers: { 'retry-after': '5', 'cache-control': 'no-store' } });
  }
  return drawn;
}
