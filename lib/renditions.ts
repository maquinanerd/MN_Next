import 'server-only';
import sharp from 'sharp';
import { COVER_VARIANTS, MAX_SOURCE_PIXELS, SOCIAL_WIDTH, type Rendition } from '@mn/seo';

/**
 * What `app/media/[id]/[variant]/route.ts` needs to draw a rendition without letting one
 * request — or a slow CMS — cost the rest: a bounded queue, a capped read, and the drawing.
 */

/** An original this large is not a photo; it is not read past this. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** How long the download of an original may take before the slot it holds is given back. */
export const DOWNLOAD_TIMEOUT_MS = 10_000;

/**
 * A queue of at most `maxConcurrent` jobs running and `maxWaiting` waiting. `run` resolves to
 * null, without running the job, when the queue is full or when `signal` — the reader's —
 * was aborted while it waited: a reader who gave up is not served a crop nobody will see.
 */
export function createQueue(maxConcurrent: number, maxWaiting: number) {
  let running = 0;
  const waiting: (() => void)[] = [];

  async function run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T | null> {
    if (running >= maxConcurrent) {
      if (waiting.length >= maxWaiting) return null;
      // The slot is handed over by the job that frees it, so `running` never overshoots.
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      running += 1;
    }
    try {
      if (signal?.aborted) return null;
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  }

  return { run, stats: () => ({ running, waiting: waiting.length }) };
}

/** The body, read up to `max` bytes; null past it, with the rest of the download cancelled. */
export async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Buffer | null> {
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

/**
 * One rendition as a JPEG.
 *
 * `failOn: 'none'`: a JPEG from the old archive often ends early and still opens in every
 * browser, and a crop must not be the one place it fails — every level above `none` aborts
 * on a truncated file. The byte and pixel limits are what guard the decoder.
 */
export function renderRendition(input: Buffer, rendition: Rendition): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: 'none' }).rotate();
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
