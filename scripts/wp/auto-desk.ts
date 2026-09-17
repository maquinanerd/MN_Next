import { DESK_SLUGS } from '@mn/content';

/**
 * A desk for the posts WordPress never filed under one.
 *
 * 296 published posts carry no category that is a desk, and the importer refuses them,
 * because an article with no desk is invisible on the portal. Most of them are ordinary
 * news whose only category is `noticias`; their other categories, their tags and their
 * title say plainly what they are about — "3ª temporada", "bilheteria", "Xbox". This
 * reads that evidence and files a post only when it points one way.
 *
 * **The rule.** Every category, every tag and the title is one *item*. An item that
 * contains a keyword of a desk gives that desk 2 points for a strong keyword or 1 for a
 * medium one — once per item and desk, however many of the desk's keywords it contains,
 * so a tag spelled twice does not vote twice. A post is filed under the desk with the
 * most points when that desk has **at least 2 points and at least twice the points of any
 * other desk**. Anything else stays out of the import, with its scores, in
 * `auto-desk.json`: a tie, a weak lead, no evidence, theme demo content, a test post.
 *
 * **Where the keywords come from.** From the 41.022 posts the newsroom did file, measured
 * per word in titles and in tags: `temporada` is series 82% of the time, `bilheteria`
 * cinema 98%, `xbox` games 99%. Strong keywords are the ones at about 80% or more in both
 * places, medium ones sit between 65% and 80%, and words below that are not keywords at
 * all however natural they look — `netflix` (57%), `trailer` (63%), `streaming` (54%),
 * `animação` (52%), `videogame` (48%, mostly film adaptations). `game` is deliberately
 * absent: at 45% it mostly means Game of Thrones.
 *
 * **How well it does.** Run over those 41.022 posts with their desk categories hidden, the
 * rule decides 73,7% of them and agrees with the newsroom on 95,7% of its cinema calls,
 * 97,6% of games and 82,2% of series. Read one by one, the series disagreements are
 * mostly the archive's, not the rule's: TV coverage filed under Filmes — "Tulsa King: 3ª
 * temporada", "The Walking Dead: episódio piloto". Where the evidence is split, as in
 * "os melhores filmes e séries do ator", the points tie and the post is left out.
 *
 * Animes and Quadrinhos cannot be measured that way — the WordPress site had no Animes
 * desk and 57 posts under Quadrinhos, so the newsroom filed that coverage under series
 * and cinema — and their keywords are the owner's. Publisher names that merely contain
 * those words (`DC Comics`, `Marvel Comics`) are neutralised before matching, since
 * they mark a franchise, not a medium. Vídeos and Especiais are formats, not subjects,
 * and are never assigned by keyword.
 */

export type EvidenceField = 'category' | 'tag' | 'title';

export interface DeskEvidence {
  desk: string;
  field: EvidenceField;
  /** The category or tag slug, or the title. */
  item: string;
  keywords: string[];
  points: number;
}

export interface DeskSignals {
  postId: number;
  slug: string;
  title: string;
  categories: readonly { slug: string; name: string }[];
  tags: readonly { slug: string; name: string }[];
}

export type DeskOutcome = 'assigned' | 'tie' | 'weak' | 'no-signal' | 'demo-content' | 'test-content';

export interface DeskDecision {
  postId: number;
  slug: string;
  title: string;
  desk: string | null;
  outcome: DeskOutcome;
  scores: Record<string, number>;
  evidence: DeskEvidence[];
  categories: string[];
  tags: string[];
}

/** At least this many points… */
export const AUTO_DESK_MIN_POINTS = 2;
/** …and at least this many times the points of the runner-up. */
export const AUTO_DESK_DOMINANCE = 2;

interface KeywordSet {
  strong: readonly string[];
  medium: readonly string[];
}

/**
 * Keywords per desk, accent-free and lower-case, matched as whole words or whole phrases.
 * Plurals are listed rather than stemmed: a stemmer that turns `series` into `seri` also
 * turns `serious` into it.
 */
export const DESK_KEYWORDS: Readonly<Record<string, KeywordSet>> = {
  cinema: {
    strong: ['filme', 'filmes', 'cinema', 'cinemas', 'bilheteria', 'bilheterias', 'movie', 'movies', 'oscar', 'oscars'],
    medium: ['sequencia'],
  },
  'series-e-tv': {
    strong: [
      'serie',
      'series',
      'temporada',
      'temporadas',
      'episodio',
      'episodios',
      'minisserie',
      'minisseries',
      'sitcom',
      'televisao',
      'emmy',
      'emmys',
    ],
    medium: ['tv', 'hbo', 'season', 'showrunner'],
  },
  games: {
    strong: [
      'games',
      'gaming',
      'gamer',
      'gameplay',
      'playstation',
      'ps4',
      'ps5',
      'xbox',
      'nintendo',
      'switch',
      'steam',
      'pc',
      'console',
      'consoles',
      'dlc',
      'multiplayer',
      'esports',
      'rpg',
      'fps',
      'mmo',
    ],
    medium: ['jogo', 'jogos', 'videogames'],
  },
  animes: {
    strong: ['anime', 'animes', 'manga', 'mangas', 'crunchyroll'],
    medium: [],
  },
  quadrinhos: {
    strong: ['quadrinho', 'quadrinhos', 'hq', 'hqs', 'comics', 'graphic novel'],
    medium: [],
  },
};

/**
 * Phrases that contain a keyword without meaning it, removed before matching.
 *
 * `DC Comics` is a publisher on news about films and series. `Jogos Vorazes` and `Jogos
 * Mortais` are film franchises — together they were most of the posts about films that
 * the first version of these rules filed under games. `Jogos olímpicos` and `vício em
 * jogos` are not video games.
 */
export const NEUTRAL_PHRASES: readonly string[] = [
  'dc comics',
  'marvel comics',
  'image comics',
  'dark horse comics',
  'idw comics',
  'jogos vorazes',
  'jogos mortais',
  'hunger games',
  'squid game',
  'jogos olimpicos',
  'jogos de azar',
  'vicio em jogos',
  'jogo do bicho',
];

/**
 * Words of the theme's demo posts. Forty lorem ipsum articles, filed under categories
 * named `vulputate` and `maecenas`, were imported with the theme and never deleted.
 */
const LOREM = new Set(
  (
    'lorem ipsum dolor sit amet consectetuer consectetur adipiscing elit aenean commodo ligula eget massa ' +
    'cum sociis natoque penatibus et magnis dis parturient montes nascetur ridiculus mus donec quam felis ' +
    'ultricies nec pellentesque eu pretium quis sem nulla consequat enim pede justo fringilla vel aliquet ' +
    'vulputate arcu in rhoncus ut imperdiet a venenatis vitae dictum mollis integer tincidunt cras dapibus ' +
    'vivamus elementum semper nisi eleifend tellus leo porttitor ac aliquam ante viverra feugiat phasellus ' +
    'metus varius laoreet quisque rutrum etiam augue curabitur ullamcorper nam sapien libero blandit ' +
    'nunc luctus tempus sed odio id orci lacinia dui eros pulvinar vici vidi tiam sodales magna mauris ' +
    'mattis neque sollicitudin'
  ).split(' '),
);

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Words of a text, space-joined and space-padded, so ` phrase ` matching is whole-word. */
function wordsOf(text: string): string {
  const words = normalise(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let joined = ` ${words.join(' ')} `;
  for (const phrase of NEUTRAL_PHRASES) joined = joined.split(` ${phrase} `).join(' ');
  return joined;
}

function isDemoContent(signals: DeskSignals): boolean {
  const words = normalise(signals.title)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length >= 3 && words.filter((w) => LOREM.has(w)).length / words.length >= 0.6) return true;
  return signals.categories.some((c) => {
    const parts = c.slug.split('-').filter(Boolean);
    return parts.length > 0 && parts.every((p) => LOREM.has(p));
  });
}

/** "Teste Mínimo", "TESTE SIMPLES 30JAN 2026": posts made to try the publishing pipeline. */
function isTestContent(signals: DeskSignals): boolean {
  return /^(teste|test)(\s|$)/.test(normalise(signals.title).trim());
}

/** The keywords of one desk found in one item, and what they are worth. */
function match(words: readonly string[], keywords: KeywordSet): { keywords: string[]; points: number } {
  const found: string[] = [];
  let points = 0;
  for (const [tier, value] of [
    [keywords.strong, 2],
    [keywords.medium, 1],
  ] as const) {
    for (const keyword of tier) {
      if (words.some((w) => w.includes(` ${keyword} `))) {
        found.push(keyword);
        points = Math.max(points, value);
      }
    }
  }
  return { keywords: found, points };
}

export function classifyDesk(signals: DeskSignals): DeskDecision {
  const base = {
    postId: signals.postId,
    slug: signals.slug,
    title: signals.title,
    categories: signals.categories.map((c) => c.slug),
    tags: signals.tags.map((t) => t.slug),
  };
  const scores: Record<string, number> = {};
  const evidence: DeskEvidence[] = [];

  if (isTestContent(signals)) return { ...base, desk: null, outcome: 'test-content', scores, evidence };
  if (isDemoContent(signals)) return { ...base, desk: null, outcome: 'demo-content', scores, evidence };

  const items: { field: EvidenceField; item: string; words: string[] }[] = [
    ...signals.categories.map((c) => ({
      field: 'category' as const,
      item: c.slug,
      words: [wordsOf(c.slug), wordsOf(c.name)],
    })),
    ...signals.tags.map((t) => ({ field: 'tag' as const, item: t.slug, words: [wordsOf(t.slug), wordsOf(t.name)] })),
    { field: 'title', item: signals.title, words: [wordsOf(signals.title)] },
  ];

  for (const { field, item, words } of items) {
    for (const [desk, keywords] of Object.entries(DESK_KEYWORDS)) {
      const found = match(words, keywords);
      if (found.points === 0) continue;
      scores[desk] = (scores[desk] ?? 0) + found.points;
      evidence.push({ desk, field, item, keywords: found.keywords, points: found.points });
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first) return { ...base, desk: null, outcome: 'no-signal', scores, evidence };
  const runnerUp = second?.[1] ?? 0;
  if (first[1] === runnerUp) return { ...base, desk: null, outcome: 'tie', scores, evidence };
  if (first[1] < AUTO_DESK_MIN_POINTS || first[1] < AUTO_DESK_DOMINANCE * runnerUp) {
    return { ...base, desk: null, outcome: 'weak', scores, evidence };
  }
  return { ...base, desk: first[0], outcome: 'assigned', scores, evidence };
}

/**
 * `auto-desk.json`: every decision with the evidence behind it, and every post left out.
 *
 * Written so the owner can read the list before an import rather than trust the rule:
 * an assignment names the words that made it, and an unresolved post carries what an
 * editor needs to file it by hand — its categories go straight into `--category-map`.
 */
export function autoDeskReport(decisions: readonly DeskDecision[]) {
  const sorted = [...decisions].sort((a, b) => a.postId - b.postId);
  const assigned = sorted.filter((d) => d.desk !== null);
  const unresolved = sorted.filter((d) => d.desk === null);
  const count = <K extends string>(keys: K[]): Record<K, number> => {
    const out = {} as Record<K, number>;
    for (const key of keys) out[key] = (out[key] ?? 0) + 1;
    return out;
  };

  return {
    note:
      'Posts sem editoria entre as categorias do WordPress, classificados por --auto-desk. ' +
      'Cada categoria, tag e o título valem 2 pontos por palavra-chave forte ou 1 por média, uma vez por editoria; ' +
      `a editoria vencedora precisa de pelo menos ${AUTO_DESK_MIN_POINTS} pontos e ${AUTO_DESK_DOMINANCE}x os pontos da segunda. ` +
      'Os não resolvidos ficam fora da importação.',
    rule: {
      minimumPoints: AUTO_DESK_MIN_POINTS,
      dominance: AUTO_DESK_DOMINANCE,
      points: { strong: 2, medium: 1 },
      keywords: DESK_KEYWORDS,
      neutralPhrases: NEUTRAL_PHRASES,
      desks: DESK_SLUGS,
    },
    counts: {
      considered: sorted.length,
      assigned: assigned.length,
      byDesk: count(assigned.map((d) => d.desk as string)),
      unresolved: unresolved.length,
      byOutcome: count(unresolved.map((d) => d.outcome)),
    },
    assigned: assigned.map((d) => ({
      postId: d.postId,
      slug: d.slug,
      title: d.title,
      desk: d.desk,
      scores: d.scores,
      evidence: d.evidence,
    })),
    unresolved: unresolved.map((d) => ({
      postId: d.postId,
      slug: d.slug,
      title: d.title,
      outcome: d.outcome,
      categories: d.categories,
      tags: d.tags,
      scores: d.scores,
      evidence: d.evidence,
    })),
  };
}
