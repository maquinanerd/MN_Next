import { describe, expect, it, vi } from 'vitest';

import { fixtureArticles, type Article, type CinerieRef } from '@mn/content';
import { cinerieServiceFrom, fetchCinerieTitles } from '@mn/content/cinerie/client';
import { validateEnv } from '@mn/content/env';
import { cinerieContextResponseSchema, mapCinerieTitles, youtubeIdOf } from '@mn/content/cinerie/map';
import { cinerieRefsFrom, parseCinerieUrl } from '@mn/content/cinerie/refs';

import { duracao, toFicha } from '../../lib/content/ficha';

/**
 * The Cinerie ficha on the article page: which work the article is about (from what the
 * writer stored in Kal El), what Cinerie answers, and what the page shows.
 *
 * The rule the module lives by (docs/02, "Cinerie e módulos opcionais retornam null"):
 * no configuration, an error or an answer outside the contract means no ficha — never a
 * broken article. And nothing Cinerie did not license is shown.
 */

const CONTEXT = {
  context: {
    contractVersion: 'cinerie-editorial-context-v1',
    requestId: 'ctx-1',
    language: 'pt-BR',
    generatedAt: '2026-11-18T12:00:00.000Z',
    entities: [
      {
        entityKind: 'movie',
        entityId: '4242',
        title: 'Duna: Parte Dois',
        originalTitle: 'Dune: Part Two',
        canonicalUrl: 'https://cinerie.com/pt/filmes/duna-parte-dois/',
        overview: 'Paul Atreides se une aos Fremen.',
        releaseDate: '2024-02-29',
        runtimeMinutes: 166,
        genres: ['Ficção científica', 'Aventura'],
        cast: [
          { entityId: '1', name: 'Timothée Chalamet', role: 'ator', character: 'Paul Atreides' },
          { entityId: '2', name: 'Zendaya', role: 'ator' },
        ],
        crew: [
          { entityId: '9', name: 'Denis Villeneuve', role: 'direção' },
          { entityId: '10', name: 'Jon Spaihts', role: 'roteiro' },
        ],
        language: 'pt-BR',
        externalIds: [],
        origin: 'cinerie_catalog',
      },
    ],
    media: [
      {
        mediaId: 'cinerie:movie:4242:poster:2',
        kind: 'image',
        role: 'poster',
        entityId: '4242',
        url: 'https://image.tmdb.org/t/p/w780/poster.jpg',
        width: 780,
        height: 1170,
        alt: 'Pôster de Duna: Parte Dois',
        credit: 'TMDB',
        licenseStatus: 'approved',
        allowedForEditorial: true,
      },
      {
        mediaId: 'cinerie:movie:4242:trailer:0',
        kind: 'trailer',
        role: 'trailer',
        entityId: '4242',
        url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        embedUrl: 'https://www.youtube-nocookie.com/embed/Way9Dexny3w',
        caption: 'Trailer oficial',
        licenseStatus: 'approved',
        allowedForEditorial: true,
      },
    ],
    availability: [
      {
        entityId: '4242',
        providerName: 'Max',
        offerType: 'flatrate',
        url: 'https://www.max.com/br',
        attributionText: 'Dados de disponibilidade: JustWatch',
      },
      { entityId: '4242', providerName: 'Apple TV', offerType: 'rent' },
    ],
    omissions: [],
  },
  resolutions: [{ index: 0, kind: 'movie', entityId: '4242', matchedBy: 'entity_id', confidence: 1, reason: null }],
};

const REF: CinerieRef = { kind: 'movie', entityId: '4242', url: 'https://cinerie.com/pt/filmes/duna-parte-dois/' };

function article(overrides: Partial<Article> = {}): Article {
  const base = fixtureArticles.find((a) => a.layout === 'standard');
  if (!base) throw new Error('fixture missing');
  return { ...base, ...overrides };
}

describe('cinerieRefsFrom', () => {
  it('reads the catalogue id from provenance and the page from a cinerie source block', () => {
    const refs = cinerieRefsFrom(
      {
        sources: [
          { provider: 'rss', externalId: 'abc' },
          {
            provider: 'cinerie',
            externalId: 'movie:4242',
            externalUrl: 'https://cinerie.com/pt/filmes/duna-parte-dois/',
          },
          { provider: 'cinerie', externalId: 'person:1' },
        ],
      },
      [
        // Same work as the provenance entry: one ficha, not two.
        {
          type: 'sourceLink',
          label: 'Duna na Cinerie',
          url: 'https://cinerie.com/pt/filmes/duna-parte-dois/',
          kind: 'cinerie',
        },
        {
          type: 'sourceLink',
          label: 'A Casa do Dragão',
          url: 'https://cinerie.com/pt/series/a-casa-do-dragao/temporada-2/',
          kind: 'cinerie',
        },
        { type: 'sourceLink', label: 'Variety', url: 'https://variety.com/x', kind: 'news' },
        { type: 'sourceLink', label: 'Falso', url: 'https://cinerie.com.evil.test/pt/filmes/x/', kind: 'cinerie' },
      ],
    );
    expect(refs).toEqual([
      {
        kind: 'movie',
        entityId: '4242',
        slug: 'duna-parte-dois',
        url: 'https://cinerie.com/pt/filmes/duna-parte-dois/',
      },
      { kind: 'tv', slug: 'a-casa-do-dragao', url: 'https://cinerie.com/pt/series/a-casa-do-dragao/' },
    ]);
  });

  it('caps the refs at three and ignores everything that is not a Cinerie title page', () => {
    const sources = Array.from({ length: 6 }, (_, i) => ({ provider: 'cinerie', externalId: `tv:${i + 1}` }));
    expect(cinerieRefsFrom({ sources }, [])).toHaveLength(3);
    expect(parseCinerieUrl('http://cinerie.com/pt/filmes/x/')).toBeNull();
    expect(parseCinerieUrl('https://cinerie.com/pt/pessoas/zendaya/')).toBeNull();
    expect(parseCinerieUrl('https://cinerie.com/pt/filmes/Com%20Espaco/')).toBeNull();
    expect(cinerieRefsFrom(null, [])).toEqual([]);
  });
});

describe('mapCinerieTitles', () => {
  it('maps the licensed ficha and keeps only what Cinerie allows', () => {
    const parsed = cinerieContextResponseSchema.parse(CONTEXT);
    const [title] = mapCinerieTitles(parsed, [REF]);
    expect(title).toMatchObject({
      kind: 'movie',
      title: 'Duna: Parte Dois',
      originalTitle: 'Dune: Part Two',
      url: 'https://cinerie.com/pt/filmes/duna-parte-dois/',
      directors: ['Denis Villeneuve'],
      trailer: { youtubeId: 'Way9Dexny3w', title: 'Trailer oficial' },
      offersCredit: 'Dados de disponibilidade: JustWatch',
    });
    expect(title?.poster?.url).toBe('https://image.tmdb.org/t/p/w780/poster.jpg');
    expect(title?.cast).toEqual([{ name: 'Timothée Chalamet', character: 'Paul Atreides' }, { name: 'Zendaya' }]);
  });

  it('drops media that is not approved for editorial use, or off the image host', () => {
    const blocked = structuredClone(CONTEXT);
    blocked.context.media[0] = { ...blocked.context.media[0]!, allowedForEditorial: false };
    blocked.context.media[1] = { ...blocked.context.media[1]!, licenseStatus: 'pending' };
    const [title] = mapCinerieTitles(cinerieContextResponseSchema.parse(blocked), [REF]);
    expect(title?.poster).toBeUndefined();
    expect(title?.trailer).toBeUndefined();

    const offHost = structuredClone(CONTEXT);
    offHost.context.media[0] = { ...offHost.context.media[0]!, url: 'https://evil.test/t/p/w780/x.jpg' };
    expect(mapCinerieTitles(cinerieContextResponseSchema.parse(offHost), [REF])[0]?.poster).toBeUndefined();
  });

  it('skips a ref Cinerie could not resolve', () => {
    const unresolved = { ...structuredClone(CONTEXT), resolutions: [{ index: 0, entityId: null }] };
    const slugRef: CinerieRef = { kind: 'movie', slug: 'x', url: 'https://cinerie.com/pt/filmes/x/' };
    expect(mapCinerieTitles(cinerieContextResponseSchema.parse(unresolved), [slugRef])).toEqual([]);
  });

  it('accepts only YouTube trailer addresses with a real id', () => {
    expect(youtubeIdOf('https://www.youtube.com/watch?v=Way9Dexny3w')).toBe('Way9Dexny3w');
    expect(youtubeIdOf('https://youtu.be/Way9Dexny3w')).toBe('Way9Dexny3w');
    expect(youtubeIdOf('https://evil.test/embed/Way9Dexny3w')).toBeNull();
    expect(youtubeIdOf('https://www.youtube.com/watch?v=curto')).toBeNull();
  });
});

describe('fetchCinerieTitles', () => {
  const service = { baseUrl: 'https://cinerie.test', token: 'token-de-teste-com-tamanho-suficiente' };

  it('asks the context service by id, server to server, with a cache tag', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(CONTEXT), { status: 200 }));
    const titles = await fetchCinerieTitles([REF], { service, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(titles).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { next?: { tags?: string[] } }];
    expect(url).toBe('https://cinerie.test/api/internal/editorial-context');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${service.token}`);
    expect(JSON.parse(String(init.body))).toEqual({ language: 'pt-BR', items: [{ kind: 'movie', entityId: '4242' }] });
    expect(init.next?.tags).toEqual(['cinerie:titles']);
  });

  it('is off without configuration and with no refs — no call at all', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchCinerieTitles([REF], { service: null, fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual(
      [],
    );
    expect(await fetchCinerieTitles([], { service, fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws on an error status or an answer outside the contract, for optional() to drop', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(
      fetchCinerieTitles([REF], { service, fetchImpl: failing as unknown as typeof fetch }),
    ).rejects.toThrow();
    const bad = vi.fn(
      async () => new Response(JSON.stringify({ context: { contractVersion: 'v0' } }), { status: 200 }),
    );
    await expect(fetchCinerieTitles([REF], { service, fetchImpl: bad as unknown as typeof fetch })).rejects.toThrow();
  });
});

describe('toFicha', () => {
  it('builds the page ficha with Portuguese labels and grouped offers', () => {
    const [title] = mapCinerieTitles(cinerieContextResponseSchema.parse(CONTEXT), [REF]);
    const ficha = toFicha(title!, article({ body: [] }));
    expect(ficha.tipo).toBe('filme');
    expect(ficha.linhaFina).toBe('Filme · 2024 · 2h 46min');
    expect(ficha.ondeAssistir).toEqual([
      { modalidade: 'Assinatura', plataformas: [{ nome: 'Max', url: 'https://www.max.com/br' }] },
      { modalidade: 'Aluguel', plataformas: [{ nome: 'Apple TV' }] },
    ]);
    expect(ficha.trailer).toEqual({ id: 'Way9Dexny3w', titulo: 'Trailer oficial' });
  });

  it('does not play the trailer twice when the text already embeds it', () => {
    const [title] = mapCinerieTitles(cinerieContextResponseSchema.parse(CONTEXT), [REF]);
    const withVideo = article({
      body: [{ type: 'embed', provider: 'youtube', url: 'https://www.youtube.com/watch?v=Way9Dexny3w' }],
    });
    expect(toFicha(title!, withVideo).trailer).toBeUndefined();
  });

  it('formats runtimes the way the ficha prints them', () => {
    expect(duracao(166)).toBe('2h 46min');
    expect(duracao(58)).toBe('58min');
    expect(duracao(120)).toBe('2h');
    expect(duracao(undefined)).toBeNull();
  });
});

describe('review fixes', () => {
  const service = { baseUrl: 'https://cinerie.test', token: 'token-de-teste-com-tamanho-suficiente' };

  it('sends identical headers for identical calls, so the data cache can hit', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(CONTEXT), { status: 200 }));
    await fetchCinerieTitles([REF], { service, fetchImpl: fetchImpl as unknown as typeof fetch });
    await fetchCinerieTitles([REF], { service, fetchImpl: fetchImpl as unknown as typeof fetch });
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1].headers).toEqual(calls[1]?.[1].headers);
    expect(calls[0]?.[1].body).toEqual(calls[1]?.[1].body);
  });

  it('a malformed Cinerie variable costs the ficha, never the environment', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      APP_ENV: 'test',
      CONTENT_SOURCE: 'fixture',
      NEXT_PUBLIC_SITE_URL: 'https://www.maquinanerd.com.br',
      CINERIE_INTERNAL_URL: 'cinerie.com',
      CINERIE_SERVICE_TOKEN: 'x',
    } as NodeJS.ProcessEnv);
    expect(env.CONTENT_SOURCE).toBe('fixture');
    expect(
      cinerieServiceFrom({ url: env.CINERIE_INTERNAL_URL, token: env.CINERIE_SERVICE_TOKEN }, 'production'),
    ).toBeNull();
  });

  it('accepts the pair only as https (http only on localhost outside production)', () => {
    const token = 'token-de-teste-com-tamanho-suficiente';
    expect(cinerieServiceFrom({ url: 'https://cinerie.com/', token }, 'production')).toEqual({
      baseUrl: 'https://cinerie.com',
      token,
    });
    expect(cinerieServiceFrom({ url: 'http://cinerie.com', token }, 'production')).toBeNull();
    expect(cinerieServiceFrom({ url: 'http://127.0.0.1:4599', token }, 'development')).not.toBeNull();
    expect(cinerieServiceFrom({ url: 'http://127.0.0.1:4599', token }, 'production')).toBeNull();
    expect(cinerieServiceFrom({ url: 'https://cinerie.com' }, 'production')).toBeNull();
    expect(cinerieServiceFrom({}, 'production')).toBeNull();
  });

  it('a film and a series with the same id never swap poster, trailer or offers', () => {
    const mixed = structuredClone(CONTEXT);
    mixed.context.media = mixed.context.media.map((m) => ({ ...m, entityKind: 'tv' }));
    mixed.context.availability = mixed.context.availability.map((a) => ({ ...a, entityKind: 'tv' }));
    const [title] = mapCinerieTitles(cinerieContextResponseSchema.parse(mixed), [REF]);
    expect(title?.poster).toBeUndefined();
    expect(title?.trailer).toBeUndefined();
    expect(title?.offers).toEqual([]);
  });

  it('serves only the w780 poster the optimiser allows', () => {
    const big = structuredClone(CONTEXT);
    big.context.media[0] = { ...big.context.media[0]!, url: 'https://image.tmdb.org/t/p/original/poster.jpg' };
    expect(mapCinerieTitles(cinerieContextResponseSchema.parse(big), [REF])[0]?.poster).toBeUndefined();
  });
});
