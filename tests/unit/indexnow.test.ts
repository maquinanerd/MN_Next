import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { INDEXNOW_KEY, announce, worthAnnouncing } from '../../lib/indexnow';

const SITE = 'https://www.maquinanerd.com.br';

function recorder(status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(null, { status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('announce — IndexNow', () => {
  it('names the key the site serves, byte for byte', () => {
    const served = readFileSync(path.join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`), 'utf8');
    expect(served.trim()).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
  });

  it('tells the engines the full URL, with the key and where to check it', async () => {
    const { calls, fetchImpl } = recorder(202);
    const result = await announce(['/cinema/uma-materia'], { appEnv: 'production', siteUrl: SITE, fetchImpl });
    expect(result).toBe('sent');
    expect(calls).toEqual([
      {
        url: 'https://api.indexnow.org/indexnow',
        body: {
          host: 'www.maquinanerd.com.br',
          key: INDEXNOW_KEY,
          keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
          urlList: [`${SITE}/cinema/uma-materia`],
        },
      },
    ]);
  });

  it('never announces from a deployment that is not production', async () => {
    for (const appEnv of ['staging', 'test', 'development', undefined]) {
      const { calls, fetchImpl } = recorder();
      expect(await announce(['/cinema/x'], { appEnv, siteUrl: SITE, fetchImpl })).toBe('skipped');
      expect(calls).toHaveLength(0);
    }
    const { calls, fetchImpl } = recorder();
    expect(await announce(['/cinema/x'], { appEnv: 'production', siteUrl: 'http://localhost:3000', fetchImpl })).toBe(
      'skipped',
    );
    expect(calls).toHaveLength(0);
  });

  it('reports a refusal or a network failure, and never throws', async () => {
    expect(await announce(['/cinema/x'], { appEnv: 'production', siteUrl: SITE, ...recorder(422) })).toBe('failed');
    const broken = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await announce(['/cinema/x'], { appEnv: 'production', siteUrl: SITE, fetchImpl: broken })).toBe('failed');
  });
});

describe('worthAnnouncing — only fresh news is pinged', () => {
  const now = Date.parse('2026-09-22T15:00:00Z');

  it('pings a story published or updated within 48 hours', () => {
    expect(worthAnnouncing('article.published', '2026-09-22T14:59:00Z', now)).toBe(true);
    expect(worthAnnouncing('article.updated', '2026-09-20T16:00:00Z', now)).toBe(true);
  });

  it('never pings the archive an import session rewrites, nor a scheduled story', () => {
    // An import delivers article.published for a post from 2025.
    expect(worthAnnouncing('article.published', '2025-08-19T15:04:54Z', now)).toBe(false);
    expect(worthAnnouncing('article.updated', '2026-09-20T14:00:00Z', now)).toBe(false);
    expect(worthAnnouncing('article.scheduled', '2026-09-22T14:59:00Z', now)).toBe(false);
    expect(worthAnnouncing('article.published', '2026-09-23T15:00:00Z', now)).toBe(false);
    expect(worthAnnouncing('article.published', 'não é data', now)).toBe(false);
  });
});
