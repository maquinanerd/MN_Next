import { cookies, draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { PREVIEW_COOKIE } from '@mn/content/security/preview';

/**
 * Ends a preview session.
 *
 * Clears both halves: the `draftMode` flag and the grant cookie that names the
 * authorised article. Leaving the grant behind would keep a valid capability in the
 * browser after the editor believed they had signed out.
 *
 * Accepts GET so the banner can offer a plain link, and POST for a form. Neither takes a
 * caller-supplied destination: the redirect target is always the site root, which is
 * what keeps this from becoming an open redirect reachable without authentication.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
};

async function end(request: Request): Promise<Response> {
  const draft = await draftMode();
  draft.disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  return NextResponse.redirect(new URL('/', new URL(request.url).origin), { status: 303, headers: PRIVATE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  return end(request);
}

export async function POST(request: Request): Promise<Response> {
  return end(request);
}
