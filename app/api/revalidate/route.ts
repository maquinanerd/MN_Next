import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { TAG, articleSlugTag, articleTag, authorTag, categoryTag, isValidSlug, tagTag } from '@mn/content';
import { serverEnv } from '@mn/content/env';
import { MemoryNonceStore, verifyWebhook } from '@mn/content/security/webhook';
import type { KalElArticlePublishedPayload } from '@mn/content/kalel/dto';

import { optional, repo } from '../../../lib/content';
import { correlationId, logger } from '../../../lib/logger';

/**
 * Kal El publication webhook.
 *
 * The tags to purge are derived here from the article id and slug in the *signed*
 * payload; the sender never names a tag. Accepting a caller-supplied tag would turn the
 * webhook secret into a cache-purge oracle for the whole site.
 *
 * The payload names only the article, so the desk, tag and author archives it appears in
 * are looked up before their tags are purged — without that step those listings stay
 * stale until their own ISR window elapses, which is up to five minutes of a new story
 * missing from its own section.
 *
 * Kal El sends no timestamp header, so replay protection is the delivery nonce plus the
 * signed `publishedAt` window (see `@mn/content/security/webhook.ts` for why, and
 * KAL-EL-DISCOVERY.md for the CMS change that would strengthen it).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const store = new MemoryNonceStore();

export async function POST(request: Request): Promise<Response> {
  const cid = correlationId(request.headers);

  let secret: string | undefined;
  let maxSkewSeconds = 300;
  try {
    const env = serverEnv();
    secret = env.KAL_EL_WEBHOOK_SECRET;
    maxSkewSeconds = env.REVALIDATE_MAX_SKEW_SECONDS;
  } catch {
    logger.error('revalidate.env-invalid', { correlationId: cid });
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  if (!secret) {
    logger.error('revalidate.no-secret', { correlationId: cid });
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  // The signature covers the raw bytes; re-serialising a parsed body would change them.
  const rawBody = await request.text();
  if (rawBody.length > 64 * 1024) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  const verdict = await verifyWebhook({
    secret,
    rawBody,
    headers: request.headers,
    store,
    maxSkewSeconds,
  });

  if (!verdict.ok) {
    // A replay is not an error to alert on: at-least-once delivery means the sender is
    // behaving correctly. It is acknowledged and dropped.
    if (verdict.status === 409) {
      logger.info('revalidate.duplicate', { correlationId: cid, reason: verdict.reason });
      return NextResponse.json({ data: { revalidated: false, reason: 'already processed' } }, { status: 200 });
    }
    logger.warn('revalidate.rejected', { correlationId: cid, reason: verdict.reason, status: verdict.status });
    return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
  }

  const payload = verdict.payload as KalElArticlePublishedPayload;
  const tags = new Set<string>([TAG.home, TAG.sitemap, TAG.news, articleTag(payload.articleId)]);
  if (payload.slug && isValidSlug(payload.slug)) tags.add(articleSlugTag(payload.slug));

  // Resolve the article's own taxonomy. If the CMS is unreachable at this moment the
  // article and home tags are still purged; the listings fall back to their ISR window
  // rather than the whole delivery failing.
  const relations = await optional(repo().relationsFor(payload.articleId), 'revalidate-relations');
  if (relations) {
    for (const slug of relations.categories) tags.add(categoryTag(slug));
    for (const slug of relations.tags) tags.add(tagTag(slug));
    for (const slug of relations.authors) tags.add(authorTag(slug));
  } else {
    // Without the relations, purge every desk: a listing showing yesterday's front page
    // is worse than a handful of extra ISR rebuilds.
    for (const desk of ['filmes', 'series', 'quadrinhos', 'games', 'animes']) tags.add(categoryTag(desk));
  }

  for (const tag of tags) revalidateTag(tag);

  logger.info('revalidate.ok', {
    correlationId: cid,
    event: verdict.event,
    articleId: payload.articleId,
    tags: tags.size,
    relationsResolved: relations !== null,
  });

  return NextResponse.json({ data: { revalidated: true, tags: [...tags] } });
}

/** Any other method is refused explicitly rather than falling through to a 405 page. */
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405, headers: { allow: 'POST' } });
}
