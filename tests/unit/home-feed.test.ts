import { describe, expect, it } from 'vitest';

import { repo } from '../../lib/content/repo';
import { FEED_PER_PAGE, OPENING, feedSemRepetir, homeView, latestView } from '../../lib/content/pages';
import type { Chamada } from '@mn/ui';

/**
 * "Mais do Máquina Nerd" (`lib/content/pages.ts`): the feed at the foot of the home lists
 * the newest stories the home has not already shown above it, and `/page/{n}` continues
 * from the story after the last one the home's feed read.
 */

const chamada = (id: string) => ({ id }) as Chamada;

describe('feedSemRepetir', () => {
  it('skips the stories already on the page and fills up to n with the next ones', () => {
    const janela = ['a', 'b', 'c', 'd', 'e', 'f'].map(chamada);
    const out = feedSemRepetir(janela, new Set(['b', 'd']), 3);
    expect(out.itens.map((c) => c.id)).toEqual(['a', 'c', 'e']);
    expect(out.lidas).toBe(5);
  });

  it('reads no further than the story that completes the page', () => {
    const out = feedSemRepetir(['a', 'b', 'c', 'd'].map(chamada), new Set(), 2);
    expect(out.itens.map((c) => c.id)).toEqual(['a', 'b']);
    expect(out.lidas).toBe(2);
  });

  it('returns what there is when the window runs out', () => {
    const out = feedSemRepetir(['a', 'b'].map(chamada), new Set(['a']), 9);
    expect(out.itens.map((c) => c.id)).toEqual(['b']);
    expect(out.lidas).toBe(2);
  });
});

/** The ids of every story the home shows above "Mais do Máquina Nerd". */
function acimaDoFeed(home: Awaited<ReturnType<typeof homeView>>): string[] {
  return [
    home.abertura.manchete,
    ...home.abertura.destaques,
    ...home.abertura.lateral,
    ...home.cinema,
    ...home.games,
    home.series.manchete,
    ...home.series.destaques,
    ...home.quadrinhos,
    ...home.animes,
    home.videos.destaque,
    ...home.videos.clipes,
  ].flatMap((c) => (c ? [c.id] : []));
}

describe('homeView — the feed never repeats the home', () => {
  it('lists none of the stories shown above it', async () => {
    const home = await homeView();
    const acima = acimaDoFeed(home);
    expect(home.feed.length).toBeGreaterThan(0);
    expect(home.feed.filter((c) => acima.includes(c.id))).toEqual([]);
  });

  it('takes the newest stories after the opening that are not above it, in order, skipping nothing else', async () => {
    const home = await homeView();
    const acima = acimaDoFeed(home);
    const stream = (await repo().listLatest(1, { skip: OPENING, perPage: 100 })).items.map((a) => a.id);
    const lidas = stream.slice(0, home.feedLidas);
    expect(home.feed.map((c) => c.id)).toEqual(lidas.filter((id) => !acima.includes(id)));
    expect(home.feed.length).toBe(FEED_PER_PAGE);
  });

  it('starts page 2 right after the last story the home read', async () => {
    const home = await homeView();
    const stream = (await repo().listLatest(1, { skip: OPENING, perPage: 100 })).items.map((a) => a.id);
    const page2 = await latestView(2);
    expect(page2.paginacao.atual).toBe(2);
    expect(page2.feed.map((c) => c.id)).toEqual(stream.slice(home.feedLidas, home.feedLidas + FEED_PER_PAGE));
    expect(page2.feed.filter((c) => home.feed.some((h) => h.id === c.id))).toEqual([]);
  });

  it('counts the pages from what the home leaves for page 2 on', async () => {
    const home = await homeView();
    const total = (await repo().listLatest(1, { skip: OPENING })).total ?? 0;
    const restantes = Math.max(0, total - home.feedLidas);
    expect(home.paginacao.total).toBe(1 + Math.ceil(restantes / FEED_PER_PAGE));
    expect(home.paginacao.temProxima).toBe(restantes > 0);
  });
});
