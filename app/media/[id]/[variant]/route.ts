import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { COVER_VARIANTS, isCoverVariant } from '@mn/seo';

import { correlationId, logger } from '../../../../lib/logger';
import { IMMUTABLE, mediaSource } from '../../../../lib/media-proxy';

/**
 * One crop of a cover — `16x9.jpg`, `4x3.jpg`, `1x1.jpg` — as a 1200 px JPEG.
 *
 * The three aspect ratios are what Google asks an Article image for, and the 16:9 one is the
 * `og:image` (`packages/seo/src/cover.ts`). A JPEG, whatever the original: the newsroom
 * uploads AVIF, which Facebook and WhatsApp do not preview. The crop follows the most
 * salient region (`attention`), so a face at the edge of a wide still is not cut away.
 *
 * Rendered once per image and variant, then cached for a year at every layer: the URL
 * names the source by id, and a media id's bytes never change.
 */

export const runtime = 'nodejs';
export const revalidate = 86400;

/** Refuses a decompression bomb before it reaches memory: 100 megapixels is past any photo. */
const MAX_INPUT_PIXELS = 100_000_000;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string; variant: string }> },
): Promise<Response> {
  const cid = correlationId(request.headers);
  const { id, variant } = await ctx.params;
  const name = variant.endsWith('.jpg') ? variant.slice(0, -'.jpg'.length) : '';
  if (!isCoverVariant(name)) return new NextResponse('Not found', { status: 404 });

  const source = await mediaSource(id, request.signal, cid);
  if (source instanceof NextResponse) return source;

  const { width, height } = COVER_VARIANTS[name];
  let jpeg: Buffer;
  try {
    const input = Buffer.from(await source.upstream.arrayBuffer());
    jpeg = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
      // A transparent PNG has no background of its own, and JPEG has no transparency.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    logger.warn('media.variant-failed', { correlationId: cid, mediaId: id, variant: name, error: String(err) });
    return new NextResponse('Unprocessable image', { status: 415 });
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
}
