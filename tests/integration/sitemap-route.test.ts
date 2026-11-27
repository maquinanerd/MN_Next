import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentError, type ContentRepository } from '@mn/content';
import { FixtureContentRepository } from '@mn/content/fixture/repository';
import { setContentRepository } from '@mn/content/provider';

import { GET } from '../../app/sitemap/[kind]/route';
import { sitemapFiles } from '../../lib/sitemap-cache';

/**
 * The child sitemaps through their route, with the CMS behind a switch.
 *
 * In production on 2026-11-27 an article file took 4.6 s, then 18.7 s when asked again, and
 * `articles-2.xml` answered 500 after 29.6 s: every request rendered the file anew, fifty
 * CMS reads each, and one slow read failed it. What is pinned here: a file is rendered once
 * and then served from memory; an expired file is served at once and refreshed behind the
 * answer; a CMS outage serves the last good copy; and with no copy the answer is a 503 with
 * `Retry-After`, never a 500.
 */

const fixture = new FixtureContentRepository();
let down = false;
let reads = 0;

/** The fixture CMS, with `listSitemap` counted and able to fail as an outage does. */
const switchable = new Proxy(fixture, {
  get(target, prop, receiver) {
    if (prop === 'listSitemap') {
      return async (...args: Parameters<ContentRepository['listSitemap']>) => {
        reads += 1;
        if (down) throw ContentError.unavailable('Kal El GET /articles timed out after 5000ms');
        return target.listSitemap(...args);
      };
    }
    const value: unknown = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
}) as ContentRepository;

async function fetchFile(kind: string): Promise<Response> {
  return GET(new Request(`https://www.maquinanerd.com.br/sitemap/${kind}`), {
    params: Promise.resolve({ kind }),
  });
}

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-27T17:00:00Z'));
  sitemapFiles.clear();
  setContentRepository(switchable);
  down = false;
  reads = 0;
});

afterEach(async () => {
  await sitemapFiles.idle();
  setContentRepository(null);
  vi.useRealTimers();
});

describe('child sitemaps', () => {
  it('render once and then answer from memory', async () => {
    const first = await fetchFile('articles-1.xml');
    expect(first.status).toBe(200);
    expect(first.headers.get('x-sitemap-cache')).toBe('miss');
    expect(first.headers.get('content-type')).toContain('application/xml');
    const body = await first.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>https://www.maquinanerd.com.br/');

    const second = await fetchFile('articles-1.xml');
    expect(second.headers.get('x-sitemap-cache')).toBe('fresh');
    expect(await second.text()).toBe(body);
    expect(reads).toBe(1);
  });

  it('serve an expired file at once and refresh it behind the answer', async () => {
    await fetchFile('categories.xml');
    vi.setSystemTime(Date.now() + HOUR + 1);
    const stale = await fetchFile('categories.xml');
    expect(stale.status).toBe(200);
    expect(stale.headers.get('x-sitemap-cache')).toBe('stale');
    await sitemapFiles.idle();
    expect(reads).toBe(2);
    expect((await fetchFile('categories.xml')).headers.get('x-sitemap-cache')).toBe('fresh');
  });

  it('keep serving the last good file through a CMS outage', async () => {
    const good = await (await fetchFile('articles-1.xml')).text();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    down = true;
    const during = await fetchFile('articles-1.xml');
    expect(during.status).toBe(200);
    expect(await during.text()).toBe(good);
    await sitemapFiles.idle();

    // A day and more later, still down: the request waits for the refresh, which fails,
    // and the old file is still the answer.
    vi.setSystemTime(Date.now() + 25 * HOUR);
    const later = await fetchFile('articles-1.xml');
    expect(later.status).toBe(200);
    expect(later.headers.get('x-sitemap-cache')).toBe('fallback');
    expect(await later.text()).toBe(good);
  });

  it('answer 503 with Retry-After when the CMS is down and there is no copy', async () => {
    down = true;
    const res = await fetchFile('articles-2.xml');
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('120');
    expect(res.headers.get('cache-control')).toBe('no-store');
    // Asked again within the minute, the outage is not re-learned with another round of reads.
    expect((await fetchFile('articles-2.xml')).status).toBe(503);
    expect(reads).toBe(1);
  });

  it('give the newest article file ten minutes and the others an hour', async () => {
    expect((await fetchFile('articles-1.xml')).headers.get('cache-control')).toContain('s-maxage=600');
    expect((await fetchFile('authors.xml')).headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('answer 404 past the last article file, without keeping anything for it', async () => {
    await expect(fetchFile('articles-99.xml')).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
    expect(sitemapFiles.size()).toBe(0);
  });

  it('answer 404 for a name that is not a sitemap, without asking the CMS', async () => {
    await expect(fetchFile('everything.xml')).rejects.toMatchObject({ digest: expect.stringContaining('404') });
    expect(reads).toBe(0);
  });
});
