import 'server-only';
import sharp from 'sharp';
import { COVER_VARIANTS, MAX_SOURCE_PIXELS, SOCIAL_WIDTH, type Rendition } from '@mn/seo';

/**
 * What `app/media/[id]/[variant]/route.ts` needs to draw a rendition without letting one
 * request — or a slow CMS — cost the rest: a bounded queue, a capped read, and the drawing.
 */

/** An original this large is not a photo; it is not read past this. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** How long one rendition — the download of the original and the drawing — may hold a slot. */
export const RENDITION_DEADLINE_MS = 20_000;

/** How long libvips may spend drawing one rendition before it gives its thread back. */
const RENDER_TIMEOUT_SECONDS = 10;

/** A job that outlived the queue's deadline: its slot was given back without it. */
export class QueueDeadlineError extends Error {
  constructor(ms: number) {
    super(`Job did not finish within ${ms}ms`);
    this.name = 'QueueDeadlineError';
  }
}

/**
 * A queue of at most `maxConcurrent` jobs running and `maxWaiting` waiting.
 *
 * `run` resolves to null, without running the job, when the line is full or when `signal` —
 * the reader's — aborts while it waits: a reader who gave up leaves the line at once instead
 * of holding a place in it, and is not served a crop nobody will see.
 *
 * A running job holds its slot for at most `deadlineMs`. Past that, `run` rejects with
 * `QueueDeadlineError` and the slot goes to the next in line whether or not the job ever
 * settles. Until 2026-10-30 nothing bounded it: a job that never returned kept its slot for
 * good, two of them closed the queue, and every cover on the site answered 503 "Busy" until
 * the container was replaced. The job is handed a signal that aborts at the deadline (or when
 * the reader leaves), so the work it can cancel — a download — is cancelled too.
 */
export function createQueue(maxConcurrent: number, maxWaiting: number, deadlineMs = Number.POSITIVE_INFINITY) {
  let running = 0;
  const waiting: (() => void)[] = [];

  function release(): void {
    // The slot is handed over by the job that frees it, so `running` never overshoots.
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }

  function admission(signal?: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const onAbort = () => {
        const at = waiting.indexOf(turn);
        if (at !== -1) waiting.splice(at, 1);
        resolve(false);
      };
      function turn() {
        signal?.removeEventListener('abort', onAbort);
        resolve(true);
      }
      waiting.push(turn);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function run<T>(work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T | null> {
    if (signal?.aborted) return null;
    if (running >= maxConcurrent) {
      if (waiting.length >= maxWaiting) return null;
      if (!(await admission(signal))) return null;
    } else {
      running += 1;
    }

    const job = new AbortController();
    const onReaderAbort = () => job.abort(signal?.reason);
    const timer = Number.isFinite(deadlineMs)
      ? setTimeout(() => job.abort(new QueueDeadlineError(deadlineMs)), deadlineMs)
      : undefined;
    try {
      if (signal?.aborted) return null;
      signal?.addEventListener('abort', onReaderAbort, { once: true });
      return await settleOrAbort(work(job.signal), job.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onReaderAbort);
      release();
    }
  }

  return { run, stats: () => ({ running, waiting: waiting.length }) };
}

/** `work`, or the signal's reason as soon as it aborts — whichever comes first. */
function settleOrAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      // The work goes on without anyone waiting for it; its failure must not go unhandled.
      work.catch(() => undefined);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
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
  // `timeout` makes libvips give up and free its worker thread: the queue's deadline frees
  // the slot, but only this frees the thread, and the image optimizer shares the pool.
  const image = sharp(input, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: 'none' })
    .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
    .rotate();
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
