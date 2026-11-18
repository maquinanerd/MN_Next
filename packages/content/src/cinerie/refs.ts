import type { CinerieKind, CinerieRef, ContentBlock } from '../domain/types';

/**
 * Which Cinerie works an article is about, from what the writer stored in Kal El.
 *
 * Two places, read in this order:
 *
 *  1. `provenance.sources[]` with `provider: "cinerie"` and `externalId: "movie:<id>"` or
 *     `"tv:<id>"` — the machine record MN-Prime writes, with the catalogue id;
 *  2. a `source` block of kind `cinerie` whose URL is a Cinerie title page
 *     (`https://cinerie.com/pt/filmes/<slug>/`) — the visible link, which an editor can
 *     also add by hand in the Kal El editor.
 *
 * Kal El needs no schema of its own for this: both fields already exist and carry free
 * text. Pure: no network, no environment.
 */

/** A page is at most about this many works; more would be a list, not a ficha. */
export const MAX_CINERIE_REFS = 3;

const CINERIE_HOSTS = new Set(['cinerie.com', 'www.cinerie.com']);
const SEGMENT_KIND: Readonly<Record<string, CinerieKind>> = { filmes: 'movie', series: 'tv' };
const ENTITY_ID = /^(movie|tv):([1-9][0-9]{0,18})$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface ProvenanceLike {
  sources: { provider: string; externalId: string; externalUrl?: string | null }[];
}

/** `{kind, slug}` of a Cinerie title page, or null for any other address. */
export function parseCinerieUrl(raw: string): { kind: CinerieKind; slug: string; url: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !CINERIE_HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // /pt/filmes/<slug>/ — a season or episode page below it is still that series.
  if (parts.length < 3 || parts[0] !== 'pt') return null;
  const kind = SEGMENT_KIND[parts[1] ?? ''];
  const slug = parts[2] ?? '';
  if (!kind || !SLUG.test(slug) || slug.length > 200) return null;
  return { kind, slug, url: `https://cinerie.com/pt/${parts[1]}/${slug}/` };
}

export function cinerieRefsFrom(provenance: ProvenanceLike | null | undefined, body: ContentBlock[]): CinerieRef[] {
  const refs: CinerieRef[] = [];
  const seen = new Set<string>();
  const push = (ref: CinerieRef, keys: string[]) => {
    if (refs.length >= MAX_CINERIE_REFS || keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    refs.push(ref);
  };

  for (const source of provenance?.sources ?? []) {
    if (source.provider !== 'cinerie') continue;
    const match = ENTITY_ID.exec(source.externalId.trim());
    if (!match) continue;
    const kind = match[1] as CinerieKind;
    const entityId = match[2] as string;
    const page = source.externalUrl ? parseCinerieUrl(source.externalUrl) : null;
    const keys = [`${kind}:id:${entityId}`, ...(page && page.kind === kind ? [`${kind}:slug:${page.slug}`] : [])];
    push(
      {
        kind,
        entityId,
        ...(page && page.kind === kind ? { slug: page.slug } : {}),
        url: page && page.kind === kind ? page.url : `https://cinerie.com/`,
      },
      keys,
    );
  }

  for (const block of body) {
    if (block.type !== 'sourceLink' || block.kind !== 'cinerie') continue;
    const page = parseCinerieUrl(block.url);
    if (!page) continue;
    push({ kind: page.kind, slug: page.slug, url: page.url }, [`${page.kind}:slug:${page.slug}`]);
  }

  return refs;
}
