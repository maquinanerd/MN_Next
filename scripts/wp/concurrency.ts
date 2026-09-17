/**
 * Bounded concurrency for the importer.
 *
 * The archive is 73.173 attachments and 41.318 posts, and every one of them is at least
 * two requests to Kal El. One at a time that is most of a day; unbounded it is a
 * self-inflicted denial of service against a CMS that answers 429 past 600 requests a
 * minute. These helpers are the middle: a fixed number of lanes, and nothing else.
 *
 * Two properties the callers rely on:
 *
 *  - **A failure stops new work but not work in flight.** An error from one item is
 *    rethrown only after every item already started has settled, so whatever those items
 *    wrote to the run state is there when the caller saves its checkpoint.
 *  - **Dispatch follows the input order.** Completion order does not, and no caller may
 *    depend on it: anything order-sensitive (slug collisions, the checkpoint cursor) is
 *    decided before dispatch or after the whole batch has settled.
 */

/** Runs `worker` over `items` with at most `limit` in flight. */
export async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const width = Math.max(1, Math.floor(limit) || 1);
  const run = { next: 0, failure: null as { error: unknown } | null };

  const lane = async (): Promise<void> => {
    while (run.failure === null && run.next < items.length) {
      const index = run.next;
      run.next += 1;
      try {
        await worker(items[index] as T, index);
      } catch (error) {
        run.failure ??= { error };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  if (run.failure !== null) throw run.failure.error;
}

/** A counting semaphore: at most `capacity` holders at once, served in arrival order. */
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity) || 1);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.capacity) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await fn();
    } finally {
      // The slot passes straight to the next waiter. Releasing and letting it be
      // re-acquired would let a newcomer that never queued jump ahead of one that did.
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}

export interface HostSlot {
  /** Gives the host its slot back before the item is finished. Calling it twice is harmless. */
  release: () => void;
}

/**
 * Runs `worker` over `items` politely towards the hosts they name.
 *
 * Two limits at once: `global` items in flight in total, and `perHost` of them holding
 * the slot of any one host. The worker releases its host slot as soon as it has stopped
 * talking to that host — a downloaded image waiting for its turn to upload is no longer
 * a connection to anybody — while the global slot is held to the end, which is what
 * bounds how many downloaded files sit in memory at once.
 *
 * Hosts are served round-robin. 28.050 of the archive's 44.304 hotlinked images come
 * from a single CDN; a plain queue would park every other host behind it, and one slow
 * host would set the pace of the whole run.
 */
export async function forEachByHost<T>(
  items: readonly T[],
  options: { hostOf: (item: T) => string; global: number; perHost: number },
  worker: (item: T, slot: HostSlot) => Promise<void>,
): Promise<void> {
  const global = Math.max(1, Math.floor(options.global) || 1);
  const perHost = Math.max(1, Math.floor(options.perHost) || 1);

  const queues = new Map<string, T[]>();
  for (const item of items) {
    const host = options.hostOf(item);
    const queue = queues.get(host);
    if (queue) queue.push(item);
    else queues.set(host, [item]);
  }
  const hosts = [...queues.keys()];
  const busy = new Map<string, number>();
  const run = { active: 0, cursor: 0, waiting: items.length, failure: null as { error: unknown } | null };

  return new Promise<void>((resolve, reject) => {
    const settleIfDone = (): void => {
      if (run.active > 0) return;
      if (run.failure !== null) reject(run.failure.error);
      else if (run.waiting === 0) resolve();
    };

    const pump = (): void => {
      if (run.failure !== null) return;
      let started = true;
      while (started && run.active < global) {
        started = false;
        for (let step = 0; step < hosts.length; step += 1) {
          const host = hosts[(run.cursor + step) % hosts.length] as string;
          const queue = queues.get(host);
          if (!queue || queue.length === 0 || (busy.get(host) ?? 0) >= perHost) continue;
          run.cursor = (run.cursor + step + 1) % hosts.length;
          start(host, queue.shift() as T);
          started = true;
          break;
        }
      }
    };

    const start = (host: string, item: T): void => {
      run.active += 1;
      run.waiting -= 1;
      busy.set(host, (busy.get(host) ?? 0) + 1);
      let holding = true;
      const slot: HostSlot = {
        release: () => {
          if (!holding) return;
          holding = false;
          busy.set(host, (busy.get(host) ?? 1) - 1);
          pump();
        },
      };
      // `Promise.resolve().then` so a worker that throws synchronously is still an
      // ordinary rejection, and the bookkeeping below runs for it like for any other.
      Promise.resolve()
        .then(() => worker(item, slot))
        .catch((error: unknown) => {
          run.failure ??= { error };
        })
        .finally(() => {
          run.active -= 1;
          slot.release();
          pump();
          settleIfDone();
        });
    };

    pump();
    settleIfDone();
  });
}

/**
 * At most one attempt per key at a time, and a success remembered.
 *
 * For something several lanes may need at the same moment and that must be made once —
 * the category of a desk. A failure (`null`, or a rejection) is forgotten as soon as it
 * settles, so the next caller tries again: one timeout must not decide the fate of every
 * later post of the desk. Callers already waiting on the failed attempt share its outcome.
 */
export function singleFlight<T>(attempt: (key: string) => Promise<T | null>): (key: string) => Promise<T | null> {
  const flights = new Map<string, Promise<T | null>>();
  return (key) => {
    const known = flights.get(key);
    if (known) return known;
    const flight = attempt(key);
    flights.set(key, flight);
    const forget = (): void => {
      if (flights.get(key) === flight) flights.delete(key);
    };
    flight.then((value) => {
      if (value === null) forget();
    }, forget);
    return flight;
  };
}
