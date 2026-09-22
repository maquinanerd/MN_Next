import { revalidateTag } from 'next/cache';
import { NextResponse, after } from 'next/server';
import {
  EDITORIA_SLUGS,
  TAG,
  articlePath,
  articleSlugTag,
  articleTag,
  authorTag,
  categoryTag,
  isValidSlug,
  tagTag,
} from '@mn/content';
import { serverEnv } from '@mn/content/env';
import { MemoryNonceStore, verifyWebhook } from '@mn/content/security/webhook';
import type { KalElArticlePublishedPayload } from '@mn/content/kalel/dto';

import { optional, repo } from '../../../lib/content';
import { announce } from '../../../lib/indexnow';
import { correlationId, logger } from '../../../lib/logger';
import { seoContext } from '../../../lib/seo-context';

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
 * Kal El sends no timestamp header, so replay protection is the delivery nonce alone (see
 * `@mn/content/security/webhook.ts` for why there is no freshness window, and
 * KAL-EL-DISCOVERY.md for the CMS change that would add a signed timestamp).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const store = new MemoryNonceStore();

/** A delivery names one article; nothing legitimate comes near this. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const cid = correlationId(request.headers);

  let secret: string | undefined;
  try {
    secret = serverEnv().KAL_EL_WEBHOOK_SECRET;
  } catch {
    logger.error('revalidate.env-invalid', { correlationId: cid });
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  if (!secret) {
    logger.error('revalidate.no-secret', { correlationId: cid });
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  // Refused on the declared size before a byte is read, and again on the bytes actually
  // read, for a sender that declares no length at all.
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  // The signature covers the raw bytes; re-serialising a parsed body would change them.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  const verdict = await verifyWebhook({ secret, rawBody, headers: request.headers, store });

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
    // Without the relations, purge every editoria: a listing showing yesterday's front
    // page is worse than a handful of extra ISR rebuilds.
    for (const desk of EDITORIA_SLUGS) tags.add(categoryTag(desk));
  }

  for (const tag of tags) revalidateTag(tag);

  // Bing and the other IndexNow engines hear of a published or changed article now, not at
  // their next crawl. After the response, so the ping never delays or fails the delivery;
  // the article's canonical path comes from the CMS, as its own page reads it.
  const slug = payload.slug && isValidSlug(payload.slug) ? payload.slug : null;
  if (slug && verdict.event !== 'article.scheduled') {
    after(async () => {
      const article = await optional(repo().getArticleBySlug(slug), 'indexnow-article');
      const path = article ? articlePath(article) : null;
      if (!path) return;
      let appEnv: string | undefined;
      try {
        appEnv = serverEnv().appEnv;
      } catch {
        return;
      }
      await announce([path], { appEnv, siteUrl: seoContext().siteUrl });
    });
  }

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
