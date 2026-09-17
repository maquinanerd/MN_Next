import { describe, expect, it } from 'vitest';

import { DESK_SLUGS } from '@mn/content';

import {
  AUTO_DESK_DOMINANCE,
  AUTO_DESK_MIN_POINTS,
  DESK_KEYWORDS,
  autoDeskReport,
  classifyDesk,
  type DeskSignals,
} from '../../scripts/wp/auto-desk';

/**
 * `--auto-desk`, on posts shaped like the 296 the archive leaves without a desk.
 *
 * The rule files a post only when its own evidence points one way, and every case that
 * does not — a tie, a lone weak hint, nothing at all, the theme's demo posts, the
 * pipeline's test posts — has to come out unresolved rather than guessed.
 */

const term = (slug: string, name = slug) => ({ slug, name });

function post(over: Partial<DeskSignals>): DeskSignals {
  return {
    postId: 1,
    slug: 'um-post',
    title: 'Um post',
    categories: [term('noticias', 'Notícias')],
    tags: [],
    ...over,
  };
}

describe('a post is filed when its evidence points one way', () => {
  it('reads the season in a title as series', () => {
    const decision = classifyDesk(post({ title: 'Bridgerton 4: Elenco e Personagens que Retornam na Nova Temporada' }));
    expect(decision).toMatchObject({ desk: 'series-e-tv', outcome: 'assigned' });
    expect(decision.evidence).toEqual([
      expect.objectContaining({ desk: 'series-e-tv', field: 'title', keywords: ['temporada'], points: 2 }),
    ]);
  });

  it('adds up categories, tags and title, once per item', () => {
    const decision = classifyDesk(
      post({
        title: 'Nintendo processa moderador do Reddit por pirataria de jogos do Switch',
        categories: [term('noticias'), term('nintendo', 'Nintendo'), term('nintendo-switch', 'Nintendo Switch')],
        tags: [term('gaming')],
      }),
    );
    expect(decision.desk).toBe('games');
    // Four items with games evidence, two points each: `nintendo-switch` names two
    // keywords and still counts once.
    expect(decision.scores).toEqual({ games: 8 });
  });

  it('matches accents, case and slugs alike', () => {
    expect(classifyDesk(post({ title: 'MINISSÉRIE ganha data' })).desk).toBe('series-e-tv');
    expect(classifyDesk(post({ tags: [term('bilheteria-mundial', 'Bilheteria Mundial')] })).desk).toBe('cinema');
  });

  it('files under Animes and Quadrinhos by the owner’s keywords', () => {
    expect(classifyDesk(post({ title: 'The Mandalorian ganha nova história com lançamento de HQ inédita' })).desk).toBe(
      'quadrinhos',
    );
    expect(classifyDesk(post({ tags: [term('crunchyroll')] })).desk).toBe('animes');
  });

  it('assigns at the threshold and not below it', () => {
    expect(AUTO_DESK_MIN_POINTS).toBe(2);
    expect(AUTO_DESK_DOMINANCE).toBe(2);
    // Exactly twice the runner-up: filed.
    const twice = classifyDesk(post({ title: 'Xbox anuncia novidades', tags: [term('hbo')] }));
    expect(twice.scores).toEqual({ games: 2, 'series-e-tv': 1 });
    expect(twice).toMatchObject({ desk: 'games', outcome: 'assigned' });
    // Ahead, but by less than that: not filed.
    const ahead = classifyDesk(
      post({ title: 'Xbox anuncia novidades', tags: [term('jogos'), term('hbo'), term('apple-tv', 'Apple TV')] }),
    );
    expect(ahead.scores).toEqual({ games: 3, 'series-e-tv': 2 });
    expect(ahead).toMatchObject({ desk: null, outcome: 'weak' });
    // A lone medium keyword is under the minimum, with nothing to compete against.
    expect(classifyDesk(post({ tags: [term('hbo')] }))).toMatchObject({ desk: null, outcome: 'weak' });
  });
});

describe('anything less than a clear answer stays out', () => {
  it('leaves a tie unresolved', () => {
    const decision = classifyDesk(post({ title: 'Steve Carell: Os 10 melhores filmes e séries do ator' }));
    expect(decision).toMatchObject({ desk: null, outcome: 'tie', scores: { cinema: 2, 'series-e-tv': 2 } });
  });

  it('leaves split evidence unresolved even when one side is ahead', () => {
    const decision = classifyDesk(
      post({ title: 'Série baseada em quadrinhos retorna ao streaming', tags: [term('quadrinhos'), term('hbo')] }),
    );
    expect(decision.scores).toEqual({ 'series-e-tv': 3, quadrinhos: 4 });
    expect(decision).toMatchObject({ desk: null, outcome: 'weak' });
  });

  it('leaves a post with no evidence unresolved', () => {
    const decision = classifyDesk(post({ title: 'Star Wars prepara terreno para morte marcante na franquia' }));
    expect(decision).toMatchObject({ desk: null, outcome: 'no-signal', scores: {}, evidence: [] });
  });

  it('never files the theme’s demo posts, whatever words they contain', () => {
    expect(classifyDesk(post({ title: 'Natoque Eget Quis Ante Nam Lorem Imperdiet' }))).toMatchObject({
      desk: null,
      outcome: 'demo-content',
    });
    // Filed under a lorem ipsum category, with a title that would otherwise count.
    expect(
      classifyDesk(post({ title: 'Filme novo', categories: [term('aenean-eleifend', 'Aenean eleifend')] })),
    ).toMatchObject({ desk: null, outcome: 'demo-content' });
  });

  it('never files a publishing test, even one tagged with a desk’s words', () => {
    const decision = classifyDesk(
      post({ title: 'Teste com Tags', tags: [term('filmes-biograficos'), term('cinema')] }),
    );
    expect(decision).toMatchObject({ desk: null, outcome: 'test-content' });
  });
});

describe('words that only look like evidence', () => {
  it('does not read a film franchise as games', () => {
    expect(classifyDesk(post({ title: 'Ralph Fiennes em Jogos Vorazes: Imagem revela o Pacificador' })).outcome).toBe(
      'no-signal',
    );
    expect(classifyDesk(post({ tags: [term('jogos-mortais', 'Jogos Mortais')] })).outcome).toBe('no-signal');
  });

  it('does not read a publisher as a medium', () => {
    const decision = classifyDesk(
      post({ categories: [term('dc-comics', 'DC Comics')], tags: [term('marvel-comics')] }),
    );
    expect(decision.outcome).toBe('no-signal');
  });

  it('does not read Game of Thrones as games', () => {
    expect(classifyDesk(post({ title: 'Nikolaj Coster-Waldau defende final de Game of Thrones' })).outcome).toBe(
      'no-signal',
    );
  });

  it('does not read gambling or the Olympics as video games', () => {
    expect(classifyDesk(post({ tags: [term('vicio-em-jogos'), term('jogos-olimpicos')] })).outcome).toBe('no-signal');
  });

  it('matches whole words only', () => {
    // `serie` inside `seriemente`, `tv` inside `tvshow`: neither is the word.
    expect(classifyDesk(post({ title: 'Ator fala seriemente sobre tvshow' })).outcome).toBe('no-signal');
  });
});

describe('the rule files only under desks the portal has', () => {
  it('names only real desks, and never the two that are formats', () => {
    for (const desk of Object.keys(DESK_KEYWORDS)) expect(DESK_SLUGS).toContain(desk);
    expect(Object.keys(DESK_KEYWORDS)).not.toContain('videos');
    expect(Object.keys(DESK_KEYWORDS)).not.toContain('especiais');
  });
});

describe('auto-desk.json', () => {
  it('lists every decision with its evidence, and every unresolved post with what an editor needs', () => {
    const report = autoDeskReport([
      classifyDesk(post({ postId: 3, title: 'Lioness ganha data de estreia para sua terceira temporada' })),
      classifyDesk(post({ postId: 1, slug: 'teste', title: 'Teste Mínimo' })),
      classifyDesk(post({ postId: 2, title: 'Top Gun 3 avança com roteiro' })),
    ]);

    expect(report.counts).toEqual({
      considered: 3,
      assigned: 1,
      byDesk: { 'series-e-tv': 1 },
      unresolved: 2,
      byOutcome: { 'test-content': 1, 'no-signal': 1 },
    });
    expect(report.assigned[0]).toMatchObject({ postId: 3, desk: 'series-e-tv' });
    expect(report.assigned[0]?.evidence.length).toBeGreaterThan(0);
    // Sorted by post id, and carrying the categories that go into --category-map.
    expect(report.unresolved.map((u) => u.postId)).toEqual([1, 2]);
    expect(report.unresolved[1]).toMatchObject({ outcome: 'no-signal', categories: ['noticias'] });
    expect(report.rule).toMatchObject({ minimumPoints: 2, dominance: 2 });
  });
});
