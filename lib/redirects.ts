// The leaf module, not the package: it imports nothing, so the edge bundle stays this file.
import { RESERVED_SEGMENTS, isEditoriaSlug } from '@mn/content/site';

import legacyTable from '../data/legacy-redirects.json';

/**
 * Legacy redirect resolution, edge-safe.
 *
 * The table is a build artefact rather than a runtime CMS read: middleware runs on every
 * request, and a network call there would put the CMS in the critical path of the whole
 * site. `pnpm redirects:build` regenerates it from Kal El and from the WordPress
 * inventory; a publication that adds a redirect reaches production with the next deploy,
 * which is the right cadence for a table that only grows at migration time.
 */

export interface RedirectMatch {
  to: string;
  status: 301 | 302 | 410;
  dropQuery?: boolean;
}

interface LegacyEntry {
  from: string;
  to: string;
  status: number;
}

const TABLE: Map<string, RedirectMatch> = new Map(
  (legacyTable as LegacyEntry[])
    .map((entry): [string, RedirectMatch] | null => {
      const to = safeInternalPath(entry.to);
      const status = entry.status === 302 ? 302 : entry.status === 410 ? 410 : 301;
      if (status !== 410 && !to) return null;
      return [normalise(entry.from), { to: to ?? '/', status }];
    })
    .filter((e): e is [string, RedirectMatch] => e !== null),
);

/** Trailing slash and case are not meaningful in a legacy WordPress permalink. */
export function normalise(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return (trimmed === '' ? '/' : trimmed).toLowerCase();
}

/**
 * Validates a redirect destination.
 *
 * Only a single-slash-rooted internal path survives. `//host`, `\host`, a scheme and a
 * double-encoded backslash are all rejected: each of them is read by some browser as an
 * absolute URL, which would turn the redirect table into an open redirect.
 */
export function safeInternalPath(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  let value = raw.trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  // Control characters and whitespace: a newline before an absolute URL is read as one by some agents.
  // (an explicit code-point check rather than a regex, so no escape survives a copy-paste)
  if ([...value].some((c) => c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f)) return null;
  if (value.includes('\\')) return null;
  // A single decode is enough to catch `%5c` and `%2f%2f`; anything still suspicious after
  // it is refused rather than normalised into something surprising.
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('\\') || decoded.startsWith('//')) return null;
  } catch {
    return null;
  }
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  // Collapse repeated slashes so `/a//b` and `/a/b` cannot both exist as destinations.
  value = value.replace(/\/{2,}/g, '/');
  return value;
}

/** WordPress endpoints that must resolve somewhere explicit rather than 404. */
const WP_RULES: { test: RegExp; to: string; status: 301 | 410; dropQuery?: boolean }[] = [
  { test: /^\/feed$/, to: '/feed.xml', status: 301 },
  { test: /^\/rss$/, to: '/feed.xml', status: 301 },
  { test: /^\/comments\/feed$/, to: '/feed.xml', status: 301 },
  { test: /^\/[^/]+\/feed$/, to: '/feed.xml', status: 301 },
  { test: /^\/wp-sitemap\.xml$/, to: '/sitemap.xml', status: 301 },
  { test: /^\/sitemap_index\.xml$/, to: '/sitemap.xml', status: 301 },
  { test: /^\/categoria\/([a-z0-9-]+)$/, to: '/$1', status: 301 },
  { test: /^\/category\/([a-z0-9-]+)$/, to: '/$1', status: 301 },
  { test: /^\/author\/([a-z0-9-]+)$/, to: '/autor/$1', status: 301 },
  { test: /^\/wp-json(\/.*)?$/, to: '/', status: 410 },
  { test: /^\/xmlrpc\.php$/, to: '/', status: 410 },
  { test: /^\/wp-admin(\/.*)?$/, to: '/', status: 410 },
  { test: /^\/wp-login\.php$/, to: '/', status: 410 },
];

/**
 * Date-based permalinks.
 *
 * The archive settled the open question: `permalink_structure` is `/%postname%/`, so the
 * site's own URLs are bare slugs and nothing here was ever published under a date. The
 * shape is still handled because links written by other people outlive a settings
 * change, and it costs one regex.
 *
 * It resolves to the slug form rather than to a table entry. `/[categoria]` looks an
 * unknown segment up in the CMS and 301s it to the article's real address, so sending
 * `/2024/05/foo` to `/foo` reaches the same answer without 41.318 rows of JSON in the
 * edge bundle to encode a rule with no exceptions in it.
 */
// The slug has a letter in it: `/2026/08/19` is the archive of a day, not a post named
// "19" — read as one, it went to `/19` and a 404.
const DATE_PERMALINK = /^\/(?:\d{4})\/(?:\d{2})(?:\/(?:\d{2}))?\/([a-z0-9-]*[a-z][a-z0-9-]*)$/;

/**
 * Desk slugs that were renamed for the new front end (kit docs/03 fixes the editoria
 * slugs). Mirrors `RENAMED_DESKS` in `packages/content/src/site.ts`; it is repeated here
 * rather than imported because this module runs at the edge and must not pull the
 * content package into the middleware bundle. `tests/unit/redirects.test.ts` fails if the
 * two ever disagree.
 *
 * `/filmes/page/3` keeps its page; `/filmes/{slug}` keeps its slug under the new desk.
 */
export const RENAMED_DESK_REDIRECTS: Record<string, string> = {
  filmes: '/cinema',
  series: '/series-e-tv',
  noticias: '/',
  reviews: '/tag/reviews',
};

const RENAMED_DESK = /^\/(filmes|series|noticias|reviews)(\/.+)$/;

function renamedDesk(path: string): string | null {
  const match = RENAMED_DESK.exec(path);
  if (!match?.[1] || !match[2]) return null;
  const base = RENAMED_DESK_REDIRECTS[match[1]] ?? '/';
  const rest = match[2];
  const paged = /^\/page\/(\d{1,4})$/.exec(rest);
  if (paged) return base === '/' ? `/page/${paged[1]}` : base.startsWith('/tag/') ? base : `${base}${rest}`;
  // Only real editorias carry articles; the others lead to their landing page.
  return base === '/cinema' || base === '/series-e-tv' ? `${base}${rest}` : base;
}

export function legacyRedirect(pathname: string, searchParams: URLSearchParams): RedirectMatch | null {
  const path = normalise(pathname);

  const exact = TABLE.get(path);
  if (exact) return exact;

  // `?p=123` - the WordPress default permalink. Without the id map there is nowhere
  // specific to send it, so it goes to the home rather than to a 404 that loses the hit.
  if (path === '/' && searchParams.has('p')) {
    const id = searchParams.get('p') ?? '';
    const mapped = TABLE.get(normalise(`/?p=${id}`));
    return mapped ?? { to: '/', status: 301, dropQuery: true };
  }

  for (const rule of WP_RULES) {
    const match = rule.test.exec(path);
    if (!match) continue;
    if (rule.status === 410) return { to: '/', status: 410 };
    const to = safeInternalPath(rule.to.replace('$1', match[1] ?? ''));
    if (to) return { to, status: 301 };
  }

  const renamed = renamedDesk(path);
  if (renamed) {
    const to = safeInternalPath(renamed);
    if (to) return { to, status: 301 };
  }

  const dated = DATE_PERMALINK.exec(path);
  if (dated?.[1]) {
    // An explicit entry still wins — an operator CSV may know this one went elsewhere.
    const mapped = TABLE.get(normalise(`/slug/${dated[1]}`));
    if (mapped) return mapped;
    return { to: `/${dated[1]}`, status: 301 };
  }

  return null;
}

/** One path segment and nothing else — no nested path, no file extension (`/ads.txt`). */
const SINGLE_SEGMENT = /^\/([^/.]+)$/;

/**
 * The segment of a path that may be a WordPress permalink, or null.
 *
 * The old site answered every article (`/%postname%/`) and, with the category base
 * stripped, every category archive at `/{slug}`. Those are resolved against the CMS by
 * `/legado/[slug]`, which renders on request: the cached `/[categoria]` page, where the
 * lookup used to live, served its cached redirects as a 308 with no `Location`. An
 * editoria and a route of this site are never candidates.
 */
export function legacyPermalinkCandidate(pathname: string): string | null {
  const segment = SINGLE_SEGMENT.exec(pathname)?.[1];
  if (!segment) return null;
  const lower = segment.toLowerCase();
  if (isEditoriaSlug(lower) || RESERVED_SEGMENTS.has(lower)) return null;
  return segment;
}

/** `/page/1` and `/{editoria}/page/1`. */
const FIRST_PAGE = /^\/(?:([a-z0-9-]+)\/)?page\/1$/;

/**
 * Where page 1 of a listing lives: the listing itself, whose URL is the canonical.
 *
 * Answered here rather than by the page, for the same reason as the permalinks: the
 * listing pages are cached, and a redirect a cached page throws loses its `Location`.
 */
export function firstPageRedirect(pathname: string): string | null {
  const match = FIRST_PAGE.exec(pathname);
  if (!match) return null;
  return match[1] ? `/${match[1]}` : '/';
}

export function redirectTableSize(): number {
  return TABLE.size;
}
