import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { isValidSlug } from '../slug';

/**
 * Preview tokens and the preview session.
 *
 * Kal El mints its own preview capability (`kpv.<base64url payload>.<hex hmac>`,
 * HMAC-SHA256 over the payload with `SESSION_SECRET`, 15-minute TTL — see
 * `apps/api/src/services/preview.ts`). That token is a bearer capability for the CMS's
 * own preview endpoint and its secret is the CMS session secret, which this application
 * must never hold. So the entry route redeems it server-side and then issues its own
 * session.
 *
 * **The session is bound to one article.** `draftMode()` alone is a global on/off flag:
 * enabling it for one article would otherwise let the same browser read every other
 * unpublished slug it can guess. The grant below is a signed cookie naming the exact
 * slug the token opened, and every preview surface checks it. Same envelope shape as the
 * entry token, so an operator reading logs sees one format:
 *
 *     mnp.<base64url({ s: slug, c: category, e: expiry })>.<hex hmac>
 */

const PREFIX = 'mnp';
export const PREVIEW_TTL_SECONDS = 15 * 60;
export const PREVIEW_COOKIE = 'mn-preview-grant';

export interface PreviewClaims {
  /** Article slug this token is valid for. */
  s: string;
  /** Category slug, so the preview lands on the canonical path. */
  c?: string;
  /** Expiry, seconds since epoch. */
  e: number;
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function createPreviewToken(
  secret: string,
  claims: { slug: string; category?: string },
  ttlSeconds = PREVIEW_TTL_SECONDS,
  now: () => number = Date.now,
): string {
  const payload: PreviewClaims = {
    s: claims.slug,
    ...(claims.category ? { c: claims.category } : {}),
    e: Math.floor(now() / 1000) + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return `${PREFIX}.${body}.${sig}`;
}

export function verifyPreviewToken(secret: string, token: string, now: () => number = Date.now): PreviewClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const body = parts[1];
  const sig = parts[2];
  if (!body || !sig) return null;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(unb64url(body)) as PreviewClaims;
    if (typeof claims.s !== 'string' || !isValidSlug(claims.s)) return null;
    if (claims.c !== undefined && !isValidSlug(claims.c)) return null;
    if (typeof claims.e !== 'number' || claims.e < Math.floor(now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * The grant written to the preview cookie.
 *
 * Identical envelope to the entry token and verified the same way; the difference is
 * where it lives and what it authorises. A grant for `resident-evil-2026` does not open
 * `outro-rascunho`, which is the property `draftMode()` on its own does not give.
 */
export function createPreviewGrant(
  secret: string,
  claims: { slug: string; category?: string },
  ttlSeconds = PREVIEW_TTL_SECONDS,
  now: () => number = Date.now,
): string {
  return createPreviewToken(secret, claims, ttlSeconds, now);
}

/** True when the grant authorises previewing exactly this slug. */
export function grantAllows(
  secret: string,
  grant: string | undefined,
  slug: string,
  now: () => number = Date.now,
): boolean {
  if (!grant) return false;
  const claims = verifyPreviewToken(secret, grant, now);
  return claims !== null && claims.s === slug;
}

/**
 * Where a verified preview token should land.
 *
 * Always an internal path built from validated slugs, never a caller-supplied
 * destination: that is what makes an open redirect impossible here.
 */
export function previewDestination(claims: PreviewClaims): string {
  return claims.c ? `/${claims.c}/${claims.s}` : `/preview/${claims.s}`;
}

/** Cookie attributes for the grant. Short-lived, HttpOnly, never cross-site. */
export function previewCookieOptions(secure: boolean, ttlSeconds = PREVIEW_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: ttlSeconds,
  };
}
