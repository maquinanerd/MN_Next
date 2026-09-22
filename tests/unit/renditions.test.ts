import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { createQueue, readCapped, renderRendition } from '../../lib/renditions';

/**
 * The media route's drawing and its guards (lib/renditions.ts), without a CMS: what a
 * review found untested — a truncated JPEG, a share image's proportions, the byte cap and
 * the queue that bounds how many run at once.
 */

async function photo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#3366aa' } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('renderRendition', () => {
  it('crops a JPEG that ends early, as the old archive has, instead of refusing it', async () => {
    const whole = await photo(1600, 900);
    const truncated = whole.subarray(0, Math.floor(whole.length * 0.6));
    const jpeg = await renderRendition(truncated, '16x9');
    expect(await sharp(jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 675 });
  });

  it('keeps a share image in its own proportions, 1200 px wide', async () => {
    const jpeg = await renderRendition(await photo(2400, 1260), 'social');
    expect(await sharp(jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
  });

  it('never enlarges a share image smaller than the card', async () => {
    const jpeg = await renderRendition(await photo(800, 600), 'social');
    expect(await sharp(jpeg).metadata()).toMatchObject({ width: 800, height: 600 });
  });

  it('turns an AVIF upload into a JPEG crop', async () => {
    const avif = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#aa3366' } })
      .avif()
      .toBuffer();
    const jpeg = await renderRendition(avif, '1x1');
    expect(await sharp(jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 1200 });
  });
});

function chunks(sizes: number[]): { stream: ReadableStream<Uint8Array>; cancelled: () => boolean } {
  let cancelled = false;
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = sizes[i++];
      if (size === undefined) controller.close();
      else controller.enqueue(new Uint8Array(size));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, cancelled: () => cancelled };
}

describe('readCapped', () => {
  it('reads a body within the cap', async () => {
    const { stream } = chunks([10, 10, 10]);
    expect((await readCapped(stream, 30))?.length).toBe(30);
  });

  it('stops past the cap and cancels the rest of the download', async () => {
    const body = chunks([10, 10, 10, 10]);
    expect(await readCapped(body.stream, 25)).toBeNull();
    expect(body.cancelled()).toBe(true);
  });
});

describe('createQueue', () => {
  it('runs no more than its limit at once, and hands each freed slot to the next', async () => {
    const queue = createQueue(2, 10);
    let running = 0;
    let peak = 0;
    const job = async (): Promise<number> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return 1;
    };
    const results = await Promise.all(Array.from({ length: 7 }, () => queue.run(job)));
    expect(results).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(peak).toBe(2);
    expect(queue.stats()).toEqual({ running: 0, waiting: 0 });
  });

  it('turns a request away when the waiting line is full', async () => {
    const queue = createQueue(1, 1);
    let release = (): void => undefined;
    const blocker = queue.run(() => new Promise<string>((resolve) => (release = () => resolve('first'))));
    const second = queue.run(async () => 'second');
    expect(await queue.run(async () => 'third')).toBeNull();
    release();
    expect(await blocker).toBe('first');
    expect(await second).toBe('second');
  });

  it('skips the work of a reader who gave up while waiting, and frees the slot', async () => {
    const queue = createQueue(1, 5);
    let release = (): void => undefined;
    const blocker = queue.run(() => new Promise<void>((resolve) => (release = resolve)));
    const reader = new AbortController();
    let ran = false;
    const gaveUp = queue.run(async () => {
      ran = true;
    }, reader.signal);
    reader.abort();
    release();
    await blocker;
    expect(await gaveUp).toBeNull();
    expect(ran).toBe(false);
    expect(queue.stats()).toEqual({ running: 0, waiting: 0 });
  });

  it('gives the slot back when the work throws', async () => {
    const queue = createQueue(1, 5);
    await expect(queue.run(() => Promise.reject(new Error('falhou')))).rejects.toThrow('falhou');
    expect(await queue.run(async () => 'depois')).toBe('depois');
  });
});
