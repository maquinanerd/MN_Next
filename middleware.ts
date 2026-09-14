import { NextResponse, type NextRequest } from 'next/server';

import { legacyRedirect } from './lib/redirects';

/**
 * Legacy URL preservation, and the indexing policy of a deployment that is not the site.
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
 *
 * Outside production every response, whichever of those it is, also says
 * `X-Robots-Tag: noindex, nofollow`. robots.txt only asks a crawler not to fetch; a staging
 * URL pasted in a chat or linked from a document is fetched anyway, and a fetched page
 * without the header may be indexed.
 */

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fixtures/).*)'],
};

export function middleware(request: NextRequest): NextResponse {
  return withIndexingPolicy(route(request));
}

function route(request: NextRequest): NextResponse {
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

/**
 * `APP_ENV` is read per request - middleware sees the running environment, not the build's -
 * falling back to `NODE_ENV` like the environment contract does.
 */
function withIndexingPolicy(response: NextResponse): NextResponse {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV;
  if (appEnv !== 'production') response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}
