import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { GET } from '../../app/api/health/route';
import { resetEnvCache } from '../../packages/content/src/env';
import { SERVICE_TOKEN, SITE_ID } from '../fake-kalel/corpus';
import { startFakeKalEl, type FakeKalEl } from '../fake-kalel/server';

/**
 * Readiness decides whether a deployment takes traffic, so every verdict it can give is
 * pinned here, against the stand-in CMS over real HTTP where the stand-in can produce the
 * case. The browser gate (`tests/kalel/delivery.spec.ts`) proves the same two main cases
 * through a running server; this file covers the refusals it cannot stage.
 */

const KEYS = ['CONTENT_SOURCE', 'KAL_EL_BASE_URL', 'KAL_EL_SITE_ID', 'KAL_EL_SERVICE_TOKEN', 'LOG_LEVEL'] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

let current: FakeKalEl;
let legacy: FakeKalEl;
/** A port that was listening a moment ago and no longer is. */
let deadUrl: string;

beforeAll(async () => {
  [current, legacy] = await Promise.all([startFakeKalEl(0), startFakeKalEl(0, { legacyArticleList: true })]);
  const gone = await startFakeKalEl(0);
  deadUrl = gone.url;
  await gone.close();
});

afterAll(async () => {
  await Promise.all([current.close(), legacy.close()]);
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetEnvCache();
  vi.unstubAllGlobals();
});

function deploy(patch: Partial<Record<(typeof KEYS)[number], string>>): void {
  Object.assign(process.env, {
    CONTENT_SOURCE: 'kalel',
    KAL_EL_SITE_ID: SITE_ID,
    KAL_EL_SERVICE_TOKEN: SERVICE_TOKEN,
    LOG_LEVEL: 'silent',
    ...patch,
  });
  resetEnvCache();
}

async function probe(path = '/api/health?ready=1'): Promise<{ status: number; body: unknown }> {
  const res = await GET(new Request(`http://127.0.0.1:3000${path}`));
  return { status: res.status, body: await res.json() };
}

describe('readiness', () => {
  it('is ready when the list carries a total, and asks exactly once, uncached', async () => {
    deploy({ KAL_EL_BASE_URL: current.url });
    const seen: { url: string; cache: RequestCache | undefined }[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), cache: init?.cache });
      return realFetch(input, init);
    });

    expect(await probe()).toEqual({
      status: 200,
      body: { status: 'ok', checks: { env: 'ok', kalel: 'ok', contract: 'ok' } },
    });

    expect(seen).toHaveLength(1);
    const asked = new URL(seen[0]?.url ?? '');
    expect(asked.pathname).toBe(`/v1/sites/${SITE_ID}/articles`);
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      status: 'published',
      order: 'published',
      limit: '1',
      offset: '0',
    });
    expect(seen[0]?.cache).toBe('no-store');
  });

  it('is degraded, not failed, when the CMS predates the offset change', async () => {
    deploy({ KAL_EL_BASE_URL: legacy.url });
    expect(await probe()).toEqual({
      status: 503,
      body: { status: 'degraded', checks: { env: 'ok', kalel: 'ok', contract: 'degraded' } },
    });
  });

  it('names a service token the CMS refuses', async () => {
    deploy({ KAL_EL_BASE_URL: current.url, KAL_EL_SERVICE_TOKEN: 'ke_st.revoked00000000000000000000000000' });
    expect(await probe()).toEqual({
      status: 503,
      body: { status: 'degraded', checks: { env: 'ok', kalel: 'unauthorized' } },
    });
  });

  it('says unreachable when nothing answers, and does not retry into its own deadline', async () => {
    deploy({ KAL_EL_BASE_URL: deadUrl });
    const started = Date.now();
    expect(await probe()).toEqual({
      status: 503,
      body: { status: 'degraded', checks: { env: 'ok', kalel: 'unreachable' } },
    });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('fails the contract when the list does not parse', async () => {
    deploy({ KAL_EL_BASE_URL: 'https://cms.example.com' });
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ data: { items: [{ id: 'not-a-uuid' }], nextCursor: null, total: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    expect(await probe()).toEqual({
      status: 503,
      body: { status: 'degraded', checks: { env: 'ok', kalel: 'ok', contract: 'fail' } },
    });
  });

  it('fails the environment before it asks the CMS anything', async () => {
    deploy({ KAL_EL_BASE_URL: current.url, KAL_EL_SITE_ID: 'not-a-uuid' });
    expect(await probe()).toEqual({ status: 503, body: { status: 'degraded', checks: { env: 'fail' } } });
  });

  it('keeps liveness independent of every one of those', async () => {
    deploy({ KAL_EL_BASE_URL: deadUrl });
    expect(await probe('/api/health')).toEqual({ status: 200, body: { status: 'ok' } });
  });
});
