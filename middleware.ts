import { NextResponse, type NextRequest } from 'next/server';

import { firstPageRedirect, legacyPermalinkCandidate, legacyRedirect } from './lib/redirects';

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
  const { search } = request.nextUrl;
  // Next's own trailing-slash redirect is off (`skipTrailingSlashRedirect`): with it, a
  // WordPress permalink — which always ended in `/` — took two hops to its article, the
  // slash first and the article after. Every answer below is given for the bare path.
  const pathname = withoutTrailingSlash(request.nextUrl.pathname);

  const match = legacyRedirect(pathname, request.nextUrl.searchParams);
  if (!match) return uncachedAnswers(request, pathname);

  if (match.status === 410) {
    return new NextResponse('Esta página foi removida permanentemente.', {
      status: 410,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
    });
  }

  // The query string is preserved unless the rule replaced it (e.g. `?p=123`).
  return NextResponse.redirect(at(request, match.to, match.dropQuery ? '' : search), match.status);
}

/**
 * The answers a cached page must not give.
 *
 * Next caches the pages that render listings and editorias, and a redirect thrown from a
 * cached page comes back from that cache as a `308` with no `Location` — a redirect to
 * nowhere for a crawler. From 2026-09-16 to 2026-09-21 that was every WordPress permalink.
 * So page 1 of a listing is redirected here, and a single segment that may be a permalink
 * is rewritten — the address stays the old one — to `/legado/[slug]`, which renders on
 * request and redirects with its destination.
 */
function uncachedAnswers(request: NextRequest, pathname: string): NextResponse {
  const { search } = request.nextUrl;

  const listing = firstPageRedirect(pathname);
  if (listing) return NextResponse.redirect(at(request, listing, search), 308);

  const permalink = legacyPermalinkCandidate(pathname);
  if (permalink) return NextResponse.rewrite(at(request, `/legado/${permalink}`, search));

  // Anything else asked for with a trailing slash goes to the address without it, as
  // Next would have sent it: one URL per page.
  if (pathname !== request.nextUrl.pathname) return NextResponse.redirect(at(request, pathname, search), 308);

  return NextResponse.next();
}

/**
 * An address on this site, built as a plain `URL`. A clone of `request.nextUrl` remembers
 * that the request ended in a slash and puts it back on whatever path it is given, so a
 * redirect from `/filmes/` would land on `/cinema/` — itself one more redirect.
 */
function at(request: NextRequest, pathname: string, search: string): URL {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = search;
  return url;
}

/** `/a/b/` → `/a/b`; the root stays `/`. */
function withoutTrailingSlash(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  return pathname.replace(/\/+$/, '') || '/';
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
