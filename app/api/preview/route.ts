import { cookies, draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidSlug, safeSlugParam } from '@mn/content';
import { serverEnv } from '@mn/content/env';
import { kalelPreviewSchema } from '@mn/content/kalel/dto';
import {
  PREVIEW_COOKIE,
  createPreviewGrant,
  previewCookieOptions,
  verifyPreviewToken,
} from '@mn/content/security/preview';

import { correlationId, logger } from '../../../lib/logger';

/**
 * Editorial preview entry point.
 *
 * Kal El mints a `kpv.<payload>.<hmac>` capability signed with its own `SESSION_SECRET`,
 * which this application must not hold. So the token is treated as opaque and redeemed
 * server-side against `GET /v1/preview/:token`; the article it returns is then checked
 * against the requested slug before any session is opened. A token for article A cannot
 * be used to open a preview of article B.
 *
 * Redemption also issues a **grant cookie naming that one slug**. `draftMode()` is a
 * global on/off flag, so without the grant a single valid token would open every
 * unpublished slug a visitor can guess; every preview surface checks the grant.
 *
 * A locally-signed `mnp.` token is also accepted, for fixture mode and for previews the
 * front end mints itself. Same guarantees, different signer.
 *
 * The response is always `noindex`, `no-store` and `no-referrer`: a preview URL carries
 * a bearer capability in its query string and must not leak through a Referer header, a
 * shared cache or a search index.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
};

const querySchema = z.object({
  token: z.string().min(16).max(2048),
  slug: z.string().max(300).optional(),
});

async function redeemKalElToken(token: string): Promise<{ slug: string | null } | null> {
  const env = serverEnv();
  if (!env.KAL_EL_BASE_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.KAL_EL_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.KAL_EL_BASE_URL}/v1/preview/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = z.object({ data: kalelPreviewSchema }).safeParse(json);
    if (!parsed.success) return null;
    return { slug: parsed.data.data.article.slug };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<Response> {
  const cid = correlationId(request.headers);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    token: url.searchParams.get('token') ?? '',
    slug: url.searchParams.get('slug') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid preview request' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const { token } = parsed.data;
  const requestedSlug = parsed.data.slug ? safeSlugParam(parsed.data.slug) : null;

  let env: ReturnType<typeof serverEnv>;
  try {
    env = serverEnv();
  } catch {
    return NextResponse.json({ error: 'not configured' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  if (!env.KAL_EL_PREVIEW_SECRET) {
    return NextResponse.json({ error: 'not configured' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  let slug: string | null = null;
  let category: string | null = null;

  if (token.startsWith('mnp.')) {
    const claims = verifyPreviewToken(env.KAL_EL_PREVIEW_SECRET, token);
    if (!claims) {
      // The token itself is never logged: it is a bearer credential.
      logger.warn('preview.rejected', { correlationId: cid, reason: 'invalid local token' });
      return NextResponse.json({ error: 'invalid or expired token' }, { status: 401, headers: PRIVATE_HEADERS });
    }
    slug = claims.s;
    category = claims.c ?? null;
  } else {
    const redeemed = await redeemKalElToken(token);
    if (!redeemed) {
      logger.warn('preview.rejected', { correlationId: cid, reason: 'kal el refused the token' });
      return NextResponse.json({ error: 'invalid or expired token' }, { status: 401, headers: PRIVATE_HEADERS });
    }
    slug = redeemed.slug && isValidSlug(redeemed.slug) ? redeemed.slug : null;
  }

  if (!slug) {
    return NextResponse.json({ error: 'article has no public slug yet' }, { status: 409, headers: PRIVATE_HEADERS });
  }

  // If the caller named a slug, it must be the one the token actually opens.
  if (requestedSlug && requestedSlug !== slug) {
    logger.warn('preview.rejected', { correlationId: cid, reason: 'slug mismatch' });
    return NextResponse.json(
      { error: 'token does not match the requested article' },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  const draft = await draftMode();
  draft.enable();

  // The grant is what scopes the session to this one article.
  const grant = createPreviewGrant(env.KAL_EL_PREVIEW_SECRET, {
    slug,
    ...(category ? { category } : {}),
  });
  const store = await cookies();
  store.set(PREVIEW_COOKIE, grant, previewCookieOptions(env.NEXT_PUBLIC_SITE_URL.startsWith('https://')));

  // The destination is built from validated slugs only — never from a caller-supplied
  // URL — which is what makes an open redirect impossible here.
  const destination = category ? `/${category}/${slug}` : `/preview/${slug}`;
  logger.info('preview.opened', { correlationId: cid, slug });

  return NextResponse.redirect(new URL(destination, url.origin), { status: 307, headers: PRIVATE_HEADERS });
}
