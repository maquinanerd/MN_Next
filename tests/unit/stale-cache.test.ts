import { describe, expect, it, vi } from 'vitest';

import { createStaleCache } from '../../lib/stale-cache';

/**
 * The cache behind the child sitemaps (lib/stale-cache.ts): fresh, stale-while-revalidate,
 * stale-if-error, one refresh at a time, and the bounds that keep it from growing.
 */

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function setup(extra: Partial<Parameters<typeof createStaleCache<string>>[0]> = {}) {
  const c = clock();
  const errors: string[] = [];
  const cache = createStaleCache<string>({
    maxEntries: 3,
    staleWhileRevalidateMs: 10_000,
    retryAfterFailureMs: 2_000,
    onBackgroundError: (key) => errors.push(key),
    now: c.now,
    ...extra,
  });
  return { cache, clock: c, errors };
}

const FRESH = { freshFor: () => 1_000 };

describe('createStaleCache', () => {
  it('produces on a miss and answers from memory while fresh', async () => {
    const { cache, clock: c } = setup();
    const produce = vi.fn(async () => 'v1');
    expect(await cache.get('a', produce, FRESH)).toEqual({ value: 'v1', state: 'miss' });
    c.advance(999);
    expect(await cache.get('a', produce, FRESH)).toEqual({ value: 'v1', state: 'fresh' });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('serves the stale copy at once and refreshes behind it', async () => {
    const { cache, clock: c } = setup();
    await cache.get('a', async () => 'v1', FRESH);
    c.advance(1_500);
    let release: (v: string) => void = () => {};
    const slow = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    expect(await cache.get('a', slow, FRESH)).toEqual({ value: 'v1', state: 'stale' });
    // A second reader while the refresh runs neither waits nor starts another one.
    expect(await cache.get('a', slow, FRESH)).toEqual({ value: 'v1', state: 'stale' });
    expect(slow).toHaveBeenCalledTimes(1);
    release('v2');
    await cache.idle();
    expect(await cache.get('a', slow, FRESH)).toEqual({ value: 'v2', state: 'fresh' });
  });

  it('keeps the last good copy when the refresh fails, and waits before trying again', async () => {
    const { cache, clock: c, errors } = setup();
    await cache.get('a', async () => 'v1', FRESH);
    c.advance(1_500);
    const failing = vi.fn(async (): Promise<string> => {
      throw new Error('cms down');
    });
    expect(await cache.get('a', failing, FRESH)).toEqual({ value: 'v1', state: 'stale' });
    await cache.idle();
    expect(errors).toEqual(['a']);
    // Inside the pause: the old copy, no new attempt.
    c.advance(1_000);
    expect(await cache.get('a', failing, FRESH)).toEqual({ value: 'v1', state: 'stale' });
    expect(failing).toHaveBeenCalledTimes(1);
    // After it: one more attempt, still behind the answer.
    c.advance(1_500);
    expect(await cache.get('a', failing, FRESH)).toEqual({ value: 'v1', state: 'stale' });
    await cache.idle();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('waits for the refresh once a copy is too old, and falls back to it if the refresh fails', async () => {
    const { cache, clock: c, errors } = setup();
    await cache.get('a', async () => 'v1', FRESH);
    c.advance(1_000 + 10_000);
    expect(await cache.get('a', async () => 'v2', FRESH)).toEqual({ value: 'v2', state: 'miss' });
    c.advance(1_000 + 10_000);
    const failing = async (): Promise<string> => {
      throw new Error('cms down');
    };
    expect(await cache.get('a', failing, FRESH)).toEqual({ value: 'v2', state: 'fallback' });
    expect(errors).toEqual(['a']);
  });

  it('fails a miss with nothing to fall back on', async () => {
    const { cache } = setup();
    await expect(
      cache.get(
        'a',
        async () => {
          throw new Error('cms down');
        },
        FRESH,
      ),
    ).rejects.toThrow('cms down');
    expect(cache.size()).toBe(0);
  });

  it('repeats a fresh failure instead of producing again, until the pause is over', async () => {
    const { cache, clock: c } = setup();
    const failing = vi.fn(async (): Promise<string> => {
      throw new Error('cms down');
    });
    await expect(cache.get('a', failing, FRESH)).rejects.toThrow('cms down');
    await expect(cache.get('a', failing, FRESH)).rejects.toThrow('cms down');
    expect(failing).toHaveBeenCalledTimes(1);
    c.advance(2_000);
    expect(await cache.get('a', async () => 'v1', FRESH)).toEqual({ value: 'v1', state: 'miss' });
  });

  it('shares one production between concurrent misses', async () => {
    const { cache } = setup();
    const produce = vi.fn(async () => 'v1');
    const [a, b] = await Promise.all([cache.get('a', produce, FRESH), cache.get('a', produce, FRESH)]);
    expect([a.value, b.value]).toEqual(['v1', 'v1']);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('keeps a value for as long as the policy says — a degraded one for less', async () => {
    const { cache, clock: c } = setup();
    const policy = { freshFor: (v: string) => (v === 'degraded' ? 100 : 1_000) };
    await cache.get('a', async () => 'degraded', policy);
    c.advance(150);
    expect((await cache.get('a', async () => 'whole', policy)).state).toBe('stale');
    await cache.idle();
    expect(await cache.get('a', async () => 'whole', policy)).toEqual({ value: 'whole', state: 'fresh' });
  });

  it('does not keep what the policy refuses, and drops what the key held', async () => {
    const { cache, clock: c } = setup();
    const policy = { freshFor: () => 1_000, keep: (v: string) => v !== 'gone' };
    await cache.get('a', async () => 'v1', policy);
    c.advance(1_000 + 10_000);
    expect(await cache.get('a', async () => 'gone', policy)).toEqual({ value: 'gone', state: 'miss' });
    expect(cache.size()).toBe(0);
    for (let i = 0; i < 10; i += 1) await cache.get(`past-${i}`, async () => 'gone', policy);
    expect(cache.size()).toBe(0);
  });

  it('settles a producer that throws synchronously, and tries it again after the pause', async () => {
    const { cache, clock: c } = setup();
    const throwsAtOnce = vi.fn((): Promise<string> => {
      throw new Error('bug');
    });
    await expect(cache.get('a', throwsAtOnce, FRESH)).rejects.toThrow('bug');
    await cache.idle();
    c.advance(2_000);
    expect(await cache.get('a', async () => 'v1', FRESH)).toEqual({ value: 'v1', state: 'miss' });
  });

  it('keeps the copy held when the new value is worse, and counts it as a failure', async () => {
    const { cache, clock: c, errors } = setup();
    const policy = { freshFor: () => 1_000, worseThan: (next: string) => next === 'degraded' };
    await cache.get('a', async () => 'whole', policy);
    c.advance(1_500);
    expect(await cache.get('a', async () => 'degraded', policy)).toEqual({ value: 'whole', state: 'stale' });
    await cache.idle();
    expect(errors).toEqual(['a']);
    // Too old to serve while refreshing: the request waits, the worse value is refused again,
    // and the copy held is the answer.
    c.advance(1_000 + 10_000);
    expect(await cache.get('a', async () => 'degraded', policy)).toEqual({ value: 'whole', state: 'fallback' });
    // With nothing held, the worse value is all there is, and it is served.
    expect(await cache.get('b', async () => 'degraded', policy)).toEqual({ value: 'degraded', state: 'miss' });
  });

  it('lets the policy shorten how long a value is served stale', async () => {
    const { cache, clock: c } = setup();
    const policy = { freshFor: () => 1_000, staleFor: () => 500 };
    await cache.get('a', async () => 'v1', policy);
    c.advance(1_200);
    expect((await cache.get('a', async () => 'v2', policy)).state).toBe('stale');
    await cache.idle();
    c.advance(1_600);
    expect(await cache.get('a', async () => 'v3', policy)).toEqual({ value: 'v3', state: 'miss' });
  });

  it('markStale makes the next request refresh behind the copy, without waiting', async () => {
    const { cache } = setup();
    await cache.get('a', async () => 'v1', FRESH);
    cache.markStale('a');
    expect(await cache.get('a', async () => 'v2', FRESH)).toEqual({ value: 'v1', state: 'stale' });
    await cache.idle();
    expect(await cache.get('a', async () => 'v3', FRESH)).toEqual({ value: 'v2', state: 'fresh' });
    cache.markStale('nothing-here');
    expect(cache.size()).toBe(1);
  });

  it('markStale never stretches how old a copy may be served', async () => {
    const { cache, clock: c } = setup();
    // Fresh 1 s and served stale 10 s more: servable for 11 s after it was stored.
    await cache.get('a', async () => 'v1', FRESH);
    c.advance(5_000);
    cache.markStale('a');
    c.advance(5_500);
    expect((await cache.get('a', async () => 'v2', FRESH)).state).toBe('stale');
    await cache.idle();
    cache.markStale('a');
    c.advance(11_000);
    expect(await cache.get('a', async () => 'v3', FRESH)).toEqual({ value: 'v3', state: 'miss' });
  });

  it('holds at most maxEntries, dropping the oldest first', async () => {
    const { cache } = setup();
    for (const key of ['a', 'b', 'c', 'd']) await cache.get(key, async () => key, FRESH);
    expect(cache.size()).toBe(3);
    const produce = vi.fn(async () => 'again');
    expect((await cache.get('a', produce, FRESH)).state).toBe('miss');
    expect((await cache.get('d', produce, FRESH)).state).toBe('fresh');
  });
});
