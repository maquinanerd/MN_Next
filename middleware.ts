import { NextResponse, type NextRequest } from 'next/server';

import { legacyRedirect } from './lib/redirects';

/**
 * Legacy URL preservation.
 *
 * Runs on the edge for every non-asset request and answers three cases:
 *
 *   1. an exact legacy path        -> 301 to its replacement
 *   2. a WordPress endpoint shape  -> 301 to the modern equivalent
 *   3. a deliberately removed URL  -> 410, never a silent 404
 *
 * Every destination is an internal, normalised path. A redirect table is operator data,
 * and an operator mistake such as `//evil.example` must not become an open redirect - so
 * the target is validated here as well as at import time.
 */

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fixtures/).*)'],
};

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const match = legacyRedirect(pathname, request.nextUrl.searchParams);
  if (!match) return NextResponse.next();

  if (match.status === 410) {
    return new NextResponse('Esta página foi removida permanentemente.', {
      status: 410,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
  }

  const url = request.nextUrl.clone();
  url.pathname = match.to;
  // The query string is preserved unless the rule replaced it (e.g. `?p=123`).
  url.search = match.dropQuery ? '' : search;

  return NextResponse.redirect(url, match.status);
}
