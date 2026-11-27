/**
 * A small in-process cache that answers from memory, refreshes behind the answer, and keeps
 * the last good copy when the refresh fails: stale-while-revalidate and stale-if-error, with
 * one refresh at a time per key.
 *
 * Built for the article sitemaps (`app/sitemap/[kind]/route.ts`). Each of those files is
 * fifty CMS reads of a hundred stories, and Kal El takes seconds for the deep offsets: on
 * 2026-11-27 `/sitemap/articles-1.xml` took 4.6 s and, asked again minutes later, 18.7 s,
 * and `/sitemap/articles-2.xml` answered 500 twice (29.6 s, 13.0 s) because one of its fifty
 * reads passed the transport's 5 s deadline. Next's own ISR is no shelter for them: its
 * entries share the 256 MB in-memory LRU with every rendered page (next-cache-handler.mjs),
 * where an 800 KB file read by Googlebot a few times a day is evicted long before it is
 * asked for again, and it would keep a degraded file for the route's whole `revalidate`.
 *
 * Bounded three ways: the number of entries (oldest evicted first), one refresh in flight
 * per key, and a pause after a failed refresh so an outage is not retried on every request.
 * It lives as long as the process: a deploy starts it empty, as it does every other cache.
 */

export type CacheState = 'fresh' | 'stale' | 'miss' | 'fallback';

export interface StaleCacheOptions {
  /** Most entries kept; past it the least recently stored goes first. */
  maxEntries: number;
  /**
   * How long past freshness a copy is still served while it refreshes behind the answer,
   * unless the policy says otherwise for a value. Older than that, a request waits for the
   * refresh — and still gets the old copy if the refresh fails (`fallback`).
   */
  staleWhileRevalidateMs: number;
  /**
   * After a failed refresh, how long a stale copy is served — or, with none, the failure
   * repeated — before the next attempt.
   */
  retryAfterFailureMs: number;
  /** Where a refresh's failure goes when a copy answers instead; never an unhandled rejection. */
  onBackgroundError?: (key: string, err: unknown) => void;
  now?: () => number;
}

export interface StorePolicy<T> {
  /** How long a produced value stays fresh — so a degraded value can be kept for less. */
  freshFor: (value: T) => number;
  /** How long past freshness the value may be served while it refreshes; default the cache's. */
  staleFor?: (value: T) => number;
  /**
   * Whether a produced value is kept at all. One that is not (a file past the end, say) is
   * returned, and takes no room from the values that exist.
   */
  keep?: (value: T) => boolean;
  /**
   * Whether a produced value is worse than the copy held — a degraded file, an empty one
   * where a whole one was. Then the copy stays, and the refresh counts as a failure.
   */
  worseThan?: (next: T, held: T) => boolean;
}

/** A produced value was refused in favour of the copy held (`StorePolicy.worseThan`). */
export class KeptPreviousCopy extends Error {
  constructor(key: string) {
    super(`Refresh of ${key} produced a worse value; the previous copy was kept`);
    this.name = 'KeptPreviousCopy';
  }
}

interface Entry<T> {
  value: T;
  storedAt: number;
  freshMs: number;
  staleMs: number;
  failedAt: number | null;
}

export interface StaleCache<T> {
  /**
   * The value for `key`: from memory while fresh; from memory and refreshed in the
   * background while stale; otherwise from `produce`, awaited.
   */
  get(key: string, produce: () => Promise<T>, policy: StorePolicy<T>): Promise<{ value: T; state: CacheState }>;
  /**
   * Ends `key`'s freshness without touching its copy: the next request is answered from the
   * copy at once and refreshes it behind the answer — within the copy's stale window; past
   * it, the request waits as usual. Nothing runs until that request comes.
   */
  markStale(key: string): void;
  /** Resolves once no refresh is in flight. */
  idle(): Promise<void>;
  clear(): void;
  size(): number;
}

export function createStaleCache<T>(options: StaleCacheOptions): StaleCache<T> {
  // Read on every call, not captured: a test that moves the system clock moves this one.
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();
  /** The last failure of a key with no copy to fall back on, for the pause after it. */
  const failures = new Map<string, { at: number; error: unknown }>();

  function bounded<V>(map: Map<string, V>, key: string, value: V): void {
    // Re-inserted so the map's order is the order of storage: the first key is the oldest.
    map.delete(key);
    map.set(key, value);
    while (map.size > options.maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  function settle(key: string, value: T, policy: StorePolicy<T>): T {
    const held = entries.get(key);
    if (held && policy.worseThan?.(value, held.value)) throw new KeptPreviousCopy(key);
    failures.delete(key);
    if (policy.keep && !policy.keep(value)) {
      entries.delete(key);
      return value;
    }
    bounded(entries, key, {
      value,
      storedAt: now(),
      freshMs: Math.max(0, policy.freshFor(value)),
      staleMs: Math.max(0, policy.staleFor?.(value) ?? options.staleWhileRevalidateMs),
      failedAt: null,
    });
    return value;
  }

  function refresh(key: string, produce: () => Promise<T>, policy: StorePolicy<T>): Promise<T> {
    const running = inflight.get(key);
    if (running) return running;
    // `produce` runs on a later tick, after the job is registered: a producer that throws
    // synchronously still settles the job, and the job still leaves `inflight`.
    const job = Promise.resolve()
      .then(produce)
      .then((value) => settle(key, value, policy))
      .catch((err: unknown) => {
        const entry = entries.get(key);
        if (entry) entry.failedAt = now();
        else bounded(failures, key, { at: now(), error: err });
        throw err;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, job);
    return job;
  }

  async function get(
    key: string,
    produce: () => Promise<T>,
    policy: StorePolicy<T>,
  ): Promise<{ value: T; state: CacheState }> {
    const entry = entries.get(key);
    if (entry) {
      const t = now();
      const age = t - entry.storedAt;
      if (age < entry.freshMs) return { value: entry.value, state: 'fresh' };

      const recentlyFailed = entry.failedAt !== null && t - entry.failedAt < options.retryAfterFailureMs;
      if (age < entry.freshMs + entry.staleMs || recentlyFailed) {
        if (!recentlyFailed) {
          refresh(key, produce, policy).catch((err: unknown) => options.onBackgroundError?.(key, err));
        }
        return { value: entry.value, state: 'stale' };
      }

      try {
        return { value: await refresh(key, produce, policy), state: 'miss' };
      } catch (err) {
        options.onBackgroundError?.(key, err);
        return { value: entry.value, state: 'fallback' };
      }
    }
    // Nothing to serve. Right after a failure the same failure is the answer, at once: in an
    // outage every request would otherwise spend another round of reads to learn it again.
    const failed = failures.get(key);
    if (failed && now() - failed.at < options.retryAfterFailureMs) throw failed.error;
    return { value: await refresh(key, produce, policy), state: 'miss' };
  }

  return {
    get,
    markStale(key) {
      const entry = entries.get(key);
      if (!entry) return;
      // The stale window counts from the end of freshness: moving that end back to the time
      // of storage keeps the copy's age limit where it was, never later.
      entry.staleMs = Math.max(0, entry.staleMs + entry.freshMs - (now() - entry.storedAt));
      entry.storedAt = now();
      entry.freshMs = 0;
      entry.failedAt = null;
    },
    async idle() {
      while (inflight.size > 0) await Promise.allSettled([...inflight.values()]);
    },
    clear() {
      entries.clear();
      failures.clear();
    },
    size: () => entries.size,
  };
}
