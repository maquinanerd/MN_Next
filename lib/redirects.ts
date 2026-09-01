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
 * The real WordPress pattern is still unconfirmed (docs/04, open question 1), so both
 * common shapes are handled and the article is looked up by slug. If the archive turns
 * out to use a third shape, this is the one function that changes.
 */
const DATE_PERMALINK = /^\/(?:\d{4})\/(?:\d{2})(?:\/(?:\d{2}))?\/([a-z0-9-]+)$/;

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

  const dated = DATE_PERMALINK.exec(path);
  if (dated?.[1]) {
    const mapped = TABLE.get(normalise(`/slug/${dated[1]}`));
    if (mapped) return mapped;
  }

  return null;
}

export function redirectTableSize(): number {
  return TABLE.size;
}
