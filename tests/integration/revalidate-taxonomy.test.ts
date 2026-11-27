import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetEnvCache } from '../../packages/content/src/env';
import { ContentError } from '../../packages/content/src/errors';
import { signWebhook } from '../../packages/content/src/security/webhook';
import type { ArticleRelations } from '../../packages/content/src/repository';
import type * as LibContent from '../../lib/content';

/**
 * Since the Kal El reads hit Next's data cache (DECISIONS §7.33), the desk and author
 * lists are served from it for their whole hour. A publication that credits one created
 * after the list was cached must purge the taxonomy, or the page renders without that
 * byline until the hour runs out — and only then: purging it on every delivery would mark
 * every page of the site stale, since every page reads the desks.
 */

const revalidated = vi.hoisted(() => [] as string[]);
const relations = vi.hoisted(() => ({ current: null as ArticleRelations | 'unavailable' | null }));

vi.mock('next/cache', () => ({ revalidateTag: (tag: string) => revalidated.push(tag) }));
vi.mock('../../lib/content', async (importOriginal) => ({
  ...(await importOriginal<typeof LibContent>()),
  repo: () => ({
    relationsFor: async () => {
      if (relations.current === 'unavailable') throw ContentError.unavailable('Kal El GET /tags failed with 503');
      if (!relations.current) throw new Error('relations not set');
      return relations.current;
    },
  }),
}));

const SECRET = 'test-webhook-secret-00000000000000000000';
const ARTICLE_ID = 'ffff1111-2222-4333-8444-555566667777';

async function deliver(): Promise<string[]> {
  const { POST } = await import('../../app/api/revalidate/route');
  // Old enough that IndexNow is not pinged: this test is about the purge alone.
  const body = JSON.stringify({
    articleId: ARTICLE_ID,
    slug: 'materia',
    publishedAt: '2020-01-01T00:00:00Z',
    version: 2,
  });
  const res = await POST(
    new Request('http://127.0.0.1:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kal-el-event': 'article.updated',
        'x-kal-el-delivery': crypto.randomUUID(),
        'x-kal-el-idempotency': `article.updated:${ARTICLE_ID}:${crypto.randomUUID()}`,
        'x-kal-el-signature': signWebhook(SECRET, body),
      },
      body,
    }),
  );
  expect(res.status).toBe(200);
  return [...revalidated];
}

describe('the publication webhook and the cached taxonomy', () => {
  beforeEach(() => {
    vi.stubEnv('KAL_EL_WEBHOOK_SECRET', SECRET);
    resetEnvCache();
    revalidated.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('leaves the taxonomy alone when the cached lists know everything the article names', async () => {
    relations.current = { categories: ['cinema'], tags: ['terror'], authors: ['rafael-lima'], staleTaxonomy: false };
    const tags = await deliver();
    expect(tags).toEqual(
      expect.arrayContaining([
        'home',
        `article:${ARTICLE_ID}`,
        'article-slug:materia',
        'category:cinema',
        'tag:terror',
        'author:rafael-lima',
      ]),
    );
    expect(tags).not.toContain('taxonomy');
  });

  it('purges the taxonomy when the article names a desk or author newer than it', async () => {
    relations.current = { categories: ['cinema'], tags: [], authors: [], staleTaxonomy: true };
    expect(await deliver()).toContain('taxonomy');
  });

  it('purges every editoria but not the taxonomy when the relations cannot be read', async () => {
    // The CMS is failing now: purging the taxonomy would take the stale copy away from every
    // page of the site, and each next visit would render against that failing CMS.
    relations.current = 'unavailable';
    const tags = await deliver();
    expect(tags).toEqual(expect.arrayContaining(['category:cinema', 'home', `article:${ARTICLE_ID}`]));
    expect(tags).not.toContain('taxonomy');
  });
});
