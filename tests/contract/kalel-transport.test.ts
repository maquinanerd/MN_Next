import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { resetEnvCache } from '../../packages/content/src/env';
import { ContentError } from '../../packages/content/src/errors';
import { KalElTransport } from '../../packages/content/src/kalel/transport';
import { kalelArticleListSchema } from '../../packages/content/src/kalel/dto';
import { ARTICLE_SUMMARY, SITE_ID } from './kalel-fixtures';

/**
 * Contract tests for the HTTP layer: what the transport does with the responses Kal El
 * can actually produce, including the ones that are not JSON.
 */

function transport(fetchImpl: typeof fetch) {
  return new KalElTransport({
    baseUrl: 'https://cms.example.com',
    token: 'ke_st.testtokenvalue000000000',
    siteId: SITE_ID,
    timeoutMs: 200,
    fetchImpl,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('KalElTransport.read', () => {
  it('unwraps the `{ data }` envelope Kal El uses', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { items: [ARTICLE_SUMMARY], nextCursor: null } }));
    const result = await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, {
      path: `/v1/sites/${SITE_ID}/articles`,
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('sends the service token as a bearer header and never in the URL', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).not.toContain('ke_st.');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer ke_st.testtokenvalue000000000');
      return jsonResponse({ data: { items: [], nextCursor: null } });
    });
    await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, {
      path: `/v1/sites/${SITE_ID}/articles`,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('serialises query parameters and drops empty values', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = new URL(String(url));
      expect(parsed.searchParams.get('status')).toBe('published');
      expect(parsed.searchParams.get('limit')).toBe('25');
      expect(parsed.searchParams.has('cursor')).toBe(false);
      return jsonResponse({ data: { items: [], nextCursor: null } });
    });
    await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, {
      path: `/v1/sites/${SITE_ID}/articles`,
      query: { status: 'published', limit: 25, cursor: undefined },
    });
  });

  it('turns 404 into a not_found ContentError without retrying', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/missing' }),
    ).rejects.toMatchObject({ kind: 'not_found' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('turns 401/403 into unauthorized and never retries a rejected credential', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: 'FORBIDDEN', message: 'nope' } }, 403));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/x' }),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries a 503 exactly once, then gives up', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/x' }),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('recovers when the retry succeeds', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      return call === 1 ? new Response('', { status: 502 }) : jsonResponse({ data: { items: [], nextCursor: null } });
    });
    const result = await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/x' });
    expect(result.items).toEqual([]);
  });

  it('reports a schema violation as a contract error, not as data', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { items: [{ id: 'not-a-uuid' }], nextCursor: null } }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/x' }),
    ).rejects.toMatchObject({ kind: 'contract' });
  });

  it('survives an HTML error page from a proxy instead of throwing a parse error', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>502</html>', { status: 502 }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/x' }),
    ).rejects.toMatchObject({ kind: 'unavailable', status: 502 });
  });

  it('times out rather than hanging the request', async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    await expect(
      transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, { path: '/slow' }),
    ).rejects.toBeInstanceOf(ContentError);
  }, 10_000);

  it('marks search reads as no-store rather than tagging them', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init as { cache?: string }).cache).toBe('no-store');
      expect((init as { next?: unknown }).next).toBeUndefined();
      return jsonResponse({ data: { items: [], nextCursor: null } });
    });
    await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, {
      path: '/x',
      noStore: true,
    });
  });

  it('attaches cache tags for a cacheable read', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const next = (init as { next?: { tags?: string[]; revalidate?: number } }).next;
      expect(next?.tags).toEqual(['home']);
      expect(next?.revalidate).toBe(60);
      return jsonResponse({ data: { items: [], nextCursor: null } });
    });
    await transport(fetchImpl as unknown as typeof fetch).read(kalelArticleListSchema, {
      path: '/x',
      tags: ['home'],
      revalidate: 60,
    });
  });
});

describe('KalElTransport.write', () => {
  it('refuses a POST without an idempotency key', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).write(null, { method: 'POST', path: '/x' }),
    ).rejects.toMatchObject({ kind: 'unsupported' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards the idempotency key and if-match headers', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('idempotency-key')).toBe('wp:post:1234');
      expect(headers.get('if-match')).toBe('3');
      return jsonResponse({ data: { ok: true } });
    });
    await transport(fetchImpl as unknown as typeof fetch).write(z.object({ ok: z.boolean() }), {
      method: 'POST',
      path: '/x',
      body: {},
      idempotencyKey: 'wp:post:1234',
      ifMatch: '3',
    });
  });

  it('never retries a write', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      transport(fetchImpl as unknown as typeof fetch).write(null, {
        method: 'POST',
        path: '/x',
        idempotencyKey: 'k-1234567890',
      }),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('KalElTransport.fromEnv', () => {
  // The construction path the application uses. It used to leave `onLog` a no-op, so the
  // alert the runbook pages on was never written by anything that ran in production.
  const KEYS = ['CONTENT_SOURCE', 'KAL_EL_BASE_URL', 'KAL_EL_SITE_ID', 'KAL_EL_SERVICE_TOKEN', 'LOG_LEVEL'] as const;
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    process.env.CONTENT_SOURCE = 'kalel';
    process.env.KAL_EL_BASE_URL = 'https://cms.example.com';
    process.env.KAL_EL_SITE_ID = SITE_ID;
    process.env.KAL_EL_SERVICE_TOKEN = 'ke_st.testtokenvalue000000000';
    process.env.LOG_LEVEL = 'warn';
    resetEnvCache();
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetEnvCache();
    vi.restoreAllMocks();
  });

  it('logs a contract violation without being handed a logger', async () => {
    const lines: string[] = [];
    const capture = (...data: unknown[]) => {
      lines.push(String(data[0]));
    };
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);

    const fetchImpl = vi.fn(async () => jsonResponse({ data: { items: [{ id: 'not-a-uuid' }], nextCursor: null } }));
    const transport = KalElTransport.fromEnv({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(transport.read(kalelArticleListSchema, { path: '/x' })).rejects.toMatchObject({ kind: 'contract' });

    const events = lines.map((line) => JSON.parse(line) as { event: string; level: string; path?: string });
    expect(events).toContainEqual(
      expect.objectContaining({ event: 'kalel.contract.violation', level: 'error', path: '/x' }),
    );
    // The line names the path and the field, never the credential that fetched it.
    expect(lines.join('\n')).not.toContain('testtokenvalue');
  });
});
