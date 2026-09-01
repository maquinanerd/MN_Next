import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  MemoryNonceStore,
  NONCE_TTL_MS,
  signWebhook,
  verifyWebhook,
} from '../../packages/content/src/security/webhook';
import {
  createPreviewToken,
  previewDestination,
  verifyPreviewToken,
} from '../../packages/content/src/security/preview';

const SECRET = 's'.repeat(48);

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    articleId: '3f4c5a2e-1111-4222-8333-444455556666',
    slug: 'resident-evil-2026',
    publishedAt: new Date().toISOString(),
    version: 3,
    ...overrides,
  });
}

function headers(body: string, overrides: Record<string, string> = {}) {
  return new Headers({
    'x-kal-el-signature': signWebhook(SECRET, body),
    'x-kal-el-event': 'article.published',
    'x-kal-el-delivery': 'd-1',
    'x-kal-el-idempotency': 'article:abc:publish:1',
    ...overrides,
  });
}

describe('webhook verification', () => {
  it('accepts a correctly signed delivery', async () => {
    const body = payload();
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body),
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict.ok).toBe(true);
  });

  it('rejects a body that was altered after signing', async () => {
    const body = payload();
    const signed = headers(body);
    const tampered = payload({ slug: 'outra-materia' });
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: tampered,
      headers: signed,
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a signature made with the wrong secret', async () => {
    const body = payload();
    const wrong = new Headers(headers(body));
    wrong.set('x-kal-el-signature', `sha256=${createHmac('sha256', 'other').update(body).digest('hex')}`);
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: wrong,
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a missing signature outright', async () => {
    const body = payload();
    const bare = new Headers({ 'x-kal-el-event': 'article.published', 'x-kal-el-idempotency': 'k' });
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: bare,
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects an event outside the allowlist', async () => {
    const body = payload();
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body, { 'x-kal-el-event': 'article.deleted' }),
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 400 });
  });

  it('treats a repeat of the same delivery key as already processed', async () => {
    const store = new MemoryNonceStore();
    const body = payload();
    const first = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body),
      store,
      maxSkewSeconds: 300,
    });
    const second = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body),
      store,
      maxSkewSeconds: 300,
    });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, status: 409 });
  });

  it('rejects a stale publication outside the freshness window', async () => {
    const body = payload({ publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body),
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 400 });
  });

  it('accepts an old publishedAt on article.updated, which legitimately carries one', async () => {
    const body = payload({ publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body, { 'x-kal-el-event': 'article.updated' }),
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict.ok).toBe(true);
  });

  it('rejects a payload that is not the agreed shape', async () => {
    const body = JSON.stringify({ nope: true });
    const verdict = await verifyWebhook({
      secret: SECRET,
      rawBody: body,
      headers: headers(body),
      store: new MemoryNonceStore(),
      maxSkewSeconds: 300,
    });
    expect(verdict).toMatchObject({ ok: false, status: 400 });
  });

  it('claims a key exactly once', async () => {
    const store = new MemoryNonceStore();
    expect(await store.claim('k', NONCE_TTL_MS)).toBe(true);
    expect(await store.claim('k', NONCE_TTL_MS)).toBe(false);
  });

  it('lets a legitimate re-delivery through once the window has passed', async () => {
    const store = new MemoryNonceStore();
    expect(await store.claim('k', 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(await store.claim('k', NONCE_TTL_MS)).toBe(true);
  });

  it('lets only one of two concurrent claims win', async () => {
    // The claim is one synchronous check-and-set precisely so this cannot tie: with a
    // separate seen()/remember() pair both callers read "unseen" before either wrote.
    const store = new MemoryNonceStore();
    const results = await Promise.all([
      store.claim('same', NONCE_TTL_MS),
      store.claim('same', NONCE_TTL_MS),
      store.claim('same', NONCE_TTL_MS),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe('preview tokens', () => {
  it('round-trips a valid token', () => {
    const token = createPreviewToken(SECRET, { slug: 'resident-evil-2026', category: 'series' });
    const claims = verifyPreviewToken(SECRET, token);
    expect(claims?.s).toBe('resident-evil-2026');
    expect(claims?.c).toBe('series');
  });

  it('rejects a token signed with another secret', () => {
    const token = createPreviewToken('other-secret-value-000000000000', { slug: 'x-y' });
    expect(verifyPreviewToken(SECRET, token)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = createPreviewToken(SECRET, { slug: 'resident-evil-2026' });
    const [prefix, body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ s: 'outra-materia', e: 9_999_999_999 })).toString('base64url');
    expect(verifyPreviewToken(SECRET, `${prefix}.${forged}.${sig}`)).toBeNull();
    expect(body).toBeTruthy();
  });

  it('rejects an expired token', () => {
    const token = createPreviewToken(SECRET, { slug: 'resident-evil-2026' }, -60);
    expect(verifyPreviewToken(SECRET, token)).toBeNull();
  });

  it('rejects a token whose slug is not a slug', () => {
    const body = Buffer.from(JSON.stringify({ s: '../../etc/passwd', e: 9_999_999_999 })).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyPreviewToken(SECRET, `mnp.${body}.${sig}`)).toBeNull();
  });

  it('builds an internal destination only', () => {
    expect(previewDestination({ s: 'a-b', c: 'series', e: 1 })).toBe('/series/a-b');
    expect(previewDestination({ s: 'a-b', e: 1 })).toBe('/preview/a-b');
  });

  it('rejects a malformed envelope', () => {
    expect(verifyPreviewToken(SECRET, 'not-a-token')).toBeNull();
    expect(verifyPreviewToken(SECRET, 'mnp.only-two-parts')).toBeNull();
  });
});
