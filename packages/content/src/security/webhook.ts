import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { KALEL_WEBHOOK_EVENTS, kalelArticlePublishedPayloadSchema, type KalElWebhookEvent } from '../kalel/dto';

/**
 * Kal El webhook verification.
 *
 * Transcribed from the real sender (`packages/events/src/index.ts` and
 * `apps/worker/src/dispatcher.ts` in the Kal El repository), not from the target spec:
 *
 *   x-kal-el-signature   `sha256=<hex hmac-sha256 of the raw body>`
 *   x-kal-el-event       `article.published` | `article.scheduled` | `article.updated`
 *   x-kal-el-delivery    per-attempt uuid
 *   x-kal-el-idempotency stable per (event, article, publish time)
 *
 * The target contract in `docs/02-kalel-integration.md` assumes a timestamp header and a
 * five-minute freshness window. **Kal El does not send one.** Protection is therefore built
 * from what is actually on the wire:
 *
 *   1. the signature covers the raw body - a forged or altered delivery is refused;
 *   2. the idempotency key is a nonce - a repeat is accepted as a no-op, never twice.
 *
 * There is deliberately no freshness window. The one this used to derive from the signed
 * `publishedAt` did not measure the age of a delivery: Kal El retries a refused delivery
 * with backoff, up to five times, so a portal that was restarting when an article went out
 * refused every retry of it and the article stayed stale until its ISR window ran out. It
 * bought nothing in exchange - a replay inside the window is stopped by the nonce, and one
 * after it can only purge a cache again. A signed delivery timestamp is the CMS change
 * recorded in `docs/migration/KAL-EL-DISCOVERY.md`.
 */

export const WEBHOOK_HEADERS = {
  signature: 'x-kal-el-signature',
  event: 'x-kal-el-event',
  delivery: 'x-kal-el-delivery',
  idempotency: 'x-kal-el-idempotency',
} as const;

export type WebhookVerdict =
  | { ok: true; event: KalElWebhookEvent; idempotencyKey: string; payload: unknown }
  | { ok: false; reason: string; status: 400 | 401 | 409 };

export function signWebhook(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Nonce store for delivery keys.
 *
 * In-process by design: revalidation is idempotent, so the worst case on a second
 * instance is one redundant cache purge, never a duplicated side effect. A shared store
 * (Redis) is the production upgrade and is documented in the runbook; the interface is
 * kept narrow so swapping it is a one-file change.
 */
export interface NonceStore {
  /**
   * Atomically claims a key. Returns true for the first caller and false for every
   * repeat within the TTL.
   *
   * Deliberately one operation, not `seen()` then `remember()`: with two, two
   * concurrent deliveries of the same event both read "unseen" before either writes, and
   * both are processed. A shared implementation maps this onto `SET key NX PX ttl`.
   */
  claim(key: string, ttlMs: number): Promise<boolean>;
}

/**
 * In-process store.
 *
 * Single-instance only, and the claim is atomic because JavaScript does not interleave
 * within a synchronous block — which is exactly why the check and the write live in one.
 * Across instances the worst case is a redundant cache purge, never a duplicated side
 * effect, since revalidation is itself idempotent. The shared store a multi-instance
 * deployment needs is in the runbook; the interface above is all it has to implement.
 */
export class MemoryNonceStore implements NonceStore {
  private readonly entries = new Map<string, number>();

  async claim(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiry = this.entries.get(key);
    if (expiry !== undefined && expiry > now) return false;
    this.entries.set(key, now + ttlMs);
    if (this.entries.size > 5_000) {
      for (const [k, exp] of this.entries) if (exp <= now) this.entries.delete(k);
    }
    return true;
  }
}

export const NONCE_TTL_MS = 24 * 60 * 60 * 1000;

export interface VerifyOptions {
  secret: string;
  rawBody: string;
  headers: Headers;
  store: NonceStore;
}

export async function verifyWebhook(opts: VerifyOptions): Promise<WebhookVerdict> {
  const signature = opts.headers.get(WEBHOOK_HEADERS.signature);
  const event = opts.headers.get(WEBHOOK_HEADERS.event);
  const idempotency = opts.headers.get(WEBHOOK_HEADERS.idempotency) ?? opts.headers.get(WEBHOOK_HEADERS.delivery);

  if (!signature) return { ok: false, reason: 'missing signature', status: 401 };
  if (!safeEqual(signWebhook(opts.secret, opts.rawBody), signature)) {
    return { ok: false, reason: 'signature mismatch', status: 401 };
  }
  if (!event || !(KALEL_WEBHOOK_EVENTS as readonly string[]).includes(event)) {
    return { ok: false, reason: `unsupported event ${event ?? '(none)'}`, status: 400 };
  }
  if (!idempotency || idempotency.length > 256) {
    return { ok: false, reason: 'missing or oversized idempotency key', status: 400 };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(opts.rawBody);
  } catch {
    return { ok: false, reason: 'body is not valid JSON', status: 400 };
  }

  const parsed = kalelArticlePublishedPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: 'payload does not match the agreed shape', status: 400 };

  // Atomic: two concurrent deliveries of the same event cannot both win this.
  if (!(await opts.store.claim(idempotency, NONCE_TTL_MS))) {
    return { ok: false, reason: 'delivery already processed', status: 409 };
  }

  return { ok: true, event: event as KalElWebhookEvent, idempotencyKey: idempotency, payload: parsed.data };
}
