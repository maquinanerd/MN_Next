import { describe, expect, it } from 'vitest';

import { RENAMED_DESKS } from '@mn/content';

import { RENAMED_DESK_REDIRECTS, legacyRedirect, normalise, safeInternalPath } from '../../lib/redirects';

/**
 * The redirect table is operator data, so the destination validator is treated as a
 * security boundary rather than a formatting helper: an entry someone pastes in must not
 * be able to become an off-site redirect.
 */
describe('safeInternalPath', () => {
  it('accepts a rooted internal path', () => {
    expect(safeInternalPath('/series/algo')).toBe('/series/algo');
  });

  it('collapses repeated slashes', () => {
    expect(safeInternalPath('/series//algo')).toBe('/series/algo');
  });

  it.each([
    ['//evil.example/phish'],
    ['https://evil.example'],
    ['/\\evil.example'],
    ['/%5cevil.example'],
    ['relative/path'],
    ['/javascript:alert(1)'],
  ])('rejects %s', (value) => {
    expect(safeInternalPath(value)).toBeNull();
  });

  it('rejects a newline-smuggled absolute URL', () => {
    expect(safeInternalPath('/\nhttps://evil.example')).toBeNull();
  });

  it('rejects an over-long destination', () => {
    expect(safeInternalPath(`/${'a'.repeat(2100)}`)).toBeNull();
  });
});

describe('normalise', () => {
  it('ignores trailing slash and case', () => {
    expect(normalise('/Series/Algo/')).toBe('/series/algo');
    expect(normalise('/')).toBe('/');
    expect(normalise('')).toBe('/');
  });
});

describe('legacyRedirect', () => {
  const noParams = new URLSearchParams();

  it('resolves an exact table entry, straight to the renamed editoria', () => {
    expect(legacyRedirect('/categoria/series', noParams)).toEqual({ to: '/series-e-tv', status: 301 });
  });

  it('is insensitive to a trailing slash', () => {
    expect(legacyRedirect('/categoria/series/', noParams)).toEqual({ to: '/series-e-tv', status: 301 });
  });

  it('sends the renamed desks to their new editorias, in one hop', () => {
    expect(legacyRedirect('/filmes', noParams)).toEqual({ to: '/cinema', status: 301 });
    expect(legacyRedirect('/series', noParams)).toEqual({ to: '/series-e-tv', status: 301 });
    expect(legacyRedirect('/noticias', noParams)).toEqual({ to: '/', status: 301 });
    expect(legacyRedirect('/reviews', noParams)).toEqual({ to: '/tag/reviews', status: 301 });
  });

  it('keeps the page and the slug under a renamed desk', () => {
    expect(legacyRedirect('/filmes/page/3', noParams)).toEqual({ to: '/cinema/page/3', status: 301 });
    expect(legacyRedirect('/series/uma-materia', noParams)).toEqual({ to: '/series-e-tv/uma-materia', status: 301 });
    expect(legacyRedirect('/noticias/page/2', noParams)).toEqual({ to: '/page/2', status: 301 });
  });

  it('agrees with the site policy on which desks were renamed', () => {
    // The edge copy exists to keep the content package out of the middleware bundle.
    expect(RENAMED_DESK_REDIRECTS).toEqual(RENAMED_DESKS);
  });

  it('sends the old advertising page to its new address', () => {
    expect(legacyRedirect('/publicidade', noParams)).toEqual({ to: '/anuncie', status: 301 });
  });

  it('sends every WordPress feed shape to the RSS route', () => {
    expect(legacyRedirect('/feed', noParams)?.to).toBe('/feed.xml');
    expect(legacyRedirect('/series/feed', noParams)?.to).toBe('/feed.xml');
    expect(legacyRedirect('/comments/feed', noParams)?.to).toBe('/feed.xml');
  });

  it('answers 410 for WordPress endpoints that are deliberately gone', () => {
    expect(legacyRedirect('/wp-json/wp/v2/posts', noParams)?.status).toBe(410);
    expect(legacyRedirect('/xmlrpc.php', noParams)?.status).toBe(410);
    expect(legacyRedirect('/wp-login.php', noParams)?.status).toBe(410);
  });

  it('maps the legacy author archive', () => {
    expect(legacyRedirect('/author/rafael-lima', noParams)).toEqual({ to: '/autor/rafael-lima', status: 301 });
  });

  it('handles the `?p=` default permalink without losing the visit', () => {
    const match = legacyRedirect('/', new URLSearchParams('p=123'));
    expect(match).toEqual({ to: '/', status: 301, dropQuery: true });
  });

  it('returns null for a path it does not own, so the route can render', () => {
    expect(legacyRedirect('/series-e-tv/uma-materia-atual', noParams)).toBeNull();
    expect(legacyRedirect('/ofertas/uma-oferta', noParams)).toBeNull();
  });

  it('never produces an off-site destination', () => {
    for (const path of ['/feed', '/categoria/series', '/author/x', '/wp-sitemap.xml']) {
      const match = legacyRedirect(path, noParams);
      if (match && match.status !== 410) expect(match.to.startsWith('/')).toBe(true);
      if (match && match.status !== 410) expect(match.to.startsWith('//')).toBe(false);
    }
  });
});
