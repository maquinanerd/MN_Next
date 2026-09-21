import { createServer, type Server, type ServerResponse } from 'node:http';

/**
 * A WordPress REST API, enough of one.
 *
 * The importer had never been run end to end. Every guarantee it makes — a dry run
 * writes nothing, a second run updates instead of duplicating, a failure exits non-zero
 * — was a property of its design and of unit tests around its pieces. This serves the
 * five collections the importer reads so those claims can be *observed* instead.
 *
 * Faithful where it matters:
 *
 *  - `X-WP-TotalPages` bounds the walk, and page N+1 answers 400. The importer trusts
 *    both rather than stopping on an empty page, so a transient error cannot silently
 *    truncate an archive.
 *  - Posts carry **numeric ids** for author, categories and tags. Looking those up in
 *    maps keyed by slug is what once made every imported article arrive with no desk and
 *    no byline — and an article with no desk is dropped from every listing.
 *  - Bodies are raw WordPress HTML with shortcodes, not clean markup, because the parser
 *    is half of what is under test.
 *  - Media points at this server's own origin, so the asset fetch is a real download
 *    subject to the importer's host allowlist and size cap.
 */

export interface FakeWordPress {
  url: string;
  close: () => Promise<void>;
  /** Requests for hotlinked images, in order — how a test tells a download from a reuse. */
  externalRequests: string[];
}

export interface FakeWordPressOptions {
  /**
   * The archive's two remaining problems, as the importer meets them.
   *
   * Body images hotlinked from another host — served by this same server under the name
   * `localhost`, which is a different host from `127.0.0.1` as far as any URL is
   * concerned: one image that downloads (only with its query string intact), one that is
   * gone, one that is an HTML page. And two posts filed under no desk: one whose title
   * says what it is about, one that gives no clue.
   */
  acervo?: boolean;
}

const rendered = (html: string) => ({ rendered: html });

/**
 * Two desks and one category that is not a desk.
 *
 * The real archive has 8.619 categories and six desks, and `noticias` — on 32.781 of the
 * 41.318 posts — is the shape that matters: a category every article carries which the
 * portal has no route for. With only desks here, the demotion rule was untested and a
 * one-to-one import looked correct.
 */
const CATEGORIES = [
  { id: 3, name: 'Filmes', slug: 'filmes', description: 'Cinema.', parent: 0, count: 3 },
  { id: 5, name: 'Séries', slug: 'series', description: 'TV.', parent: 0, count: 3 },
  { id: 9, name: 'Notícias', slug: 'noticias', description: 'Tudo.', parent: 0, count: 6 },
];

/** How many of those are desks, and therefore Kal El categories. */
const DESK_CATEGORIES = 2;

const TAGS = [
  { id: 11, name: 'Marvel', slug: 'marvel' },
  { id: 12, name: 'Netflix', slug: 'netflix' },
  // As the real archive stores them, and as the first production session failed on them:
  // a name HTML-escaped, and a list of titles past a tag's 80 characters (wp 1614).
  { id: 13, name: 'Deadpool &amp; Wolverine', slug: 'deadpool-wolverine' },
  {
    id: 14,
    name: 'Múltiplos títulos de filmes (incluindo Jaws, Blade Runner: The Final Cut, Alien: Romulus, American Psycho, Kill Bill)',
    slug: 'multiplos-titulos-de-filmes-incluindo-jaws-blade-runner-the-final-cut-alien-romulus-american-psycho-kill-bill',
  },
];

/**
 * One paragraph past a text node's 10.000 characters, the shape of the three posts the
 * first production session lost (wp 113552, 114755, 116292): an automation that never
 * broke a line.
 */
export const GIANT_PARAGRAPH =
  'Um parágrafo que nunca termina, escrito por uma automação sem quebras de linha. '.repeat(160);

const USERS = [
  { id: 2, name: 'Redação', slug: 'redacao', description: 'A redação.' },
  { id: 7, name: 'Juliana Prado', slug: 'juliana-prado', description: 'Cobre séries.' },
];

const POST_COUNT = 6;
const MEDIA_COUNT = 2;

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

function mediaRows(origin: string): Record<string, unknown>[] {
  return [
    {
      id: 101,
      slug: 'capa-um',
      source_url: `${origin}/wp-content/uploads/2026/08/capa-um.jpg`,
      mime_type: 'image/jpeg',
      alt_text: 'Cena de abertura',
      caption: rendered('Divulgação'),
      media_details: { width: 1600, height: 900, file: '2026/08/capa-um.jpg' },
    },
    {
      id: 102,
      slug: 'capa-dois',
      source_url: `${origin}/wp-content/uploads/2026/08/capa-dois.jpg`,
      mime_type: 'image/jpeg',
      // No alt text, so the report has something real to count.
      alt_text: '',
      media_details: { width: 1200, height: 800, file: '2026/08/capa-dois.jpg' },
    },
  ];
}

/** Raw WordPress body: shortcodes, a resized image URL, an embed, a cited quote. */
function body(i: number, origin: string, hotlinks: string | null): string {
  return [
    `<p>Primeiro parágrafo da matéria ${i}, com <strong>ênfase</strong> e um <a href="https://exemplo.test">link</a>.</p>`,
    '<h2>Um subtítulo</h2>',
    '<p>Segundo parágrafo.</p>',
    // The `-800x450` suffix is WordPress's resized variant; the importer has to canonicalise
    // it back to the original before it can match the media row.
    `[caption id="attachment_101" width="800"]<img src="${origin}/wp-content/uploads/2026/08/capa-um-800x450.jpg" /> Uma legenda[/caption]`,
    '<ul><li>Primeiro item</li><li>Segundo item</li></ul>',
    '[gallery ids="101,102"]',
    '[embed]https://www.youtube.com/watch?v=abc123[/embed]',
    '<blockquote><p>Uma citação.</p><cite>Fonte</cite></blockquote>',
    ...(i === 2 ? [`<p>${GIANT_PARAGRAPH}</p>`] : []),
    // The `&#038;` WordPress writes into URLs, with no alt text: the alt has to come from
    // the next post that shows the same picture.
    ...(hotlinks !== null && i === 1
      ? [`<p>De outro veículo:</p><img src="${hotlinks}/external/capa.jpg?w=1100&#038;q=80" alt="" />`]
      : []),
  ].join('\n');
}

/** A post with no desk among its categories, whose title is the evidence of one. */
function unfiledPost(origin: string, hotlinks: string): Record<string, unknown> {
  return {
    id: 2000,
    date_gmt: '2026-08-30T12:00:00',
    modified_gmt: '2026-08-30T13:00:00',
    slug: 'xbox-revela-novo-console-portatil',
    status: 'publish',
    type: 'post',
    link: `${origin}/xbox-revela-novo-console-portatil/`,
    title: rendered('Xbox revela novo console portátil'),
    content: rendered(
      [
        '<p>O console chega em novembro.</p>',
        // The same picture as in post 1001, spelled `&amp;` this time.
        `<img src="${hotlinks}/external/capa.jpg?w=1100&amp;q=80" alt="Console portátil em destaque" />`,
        `<img src="${hotlinks}/external/sumiu.jpg" alt="" />`,
        `<img src="${hotlinks}/external/pagina.jpg" alt="" />`,
      ].join('\n'),
    ),
    excerpt: rendered('<p>O console chega em novembro.</p>'),
    author: 2,
    featured_media: 101,
    categories: [9],
    tags: [],
  };
}

/**
 * Post 2000 published a second time, seconds later, the way the archive's real copies were
 * (9880/9886): the same title and body byte for byte, WordPress's `-2` on the slug, and a
 * second upload of the cover. The import skips it; its old URL is `redirects:build`'s.
 */
function copyPost(origin: string, hotlinks: string): Record<string, unknown> {
  return {
    ...unfiledPost(origin, hotlinks),
    id: 2002,
    date_gmt: '2026-08-30T12:00:20',
    modified_gmt: '2026-08-30T13:00:20',
    slug: 'xbox-revela-novo-console-portatil-2',
    link: `${origin}/xbox-revela-novo-console-portatil-2/`,
    featured_media: 102,
  };
}

/**
 * A post with no desk and no evidence of one: `--auto-desk` leaves it out, on a list. Its
 * hotlinked image belongs to a post that will not be imported, so it is never fetched.
 */
function leftOutPost(origin: string, hotlinks: string): Record<string, unknown> {
  return {
    id: 2001,
    date_gmt: '2026-08-31T12:00:00',
    modified_gmt: '2026-08-31T13:00:00',
    slug: 'star-wars-prepara-terreno',
    status: 'publish',
    type: 'post',
    link: `${origin}/star-wars-prepara-terreno/`,
    title: rendered('Star Wars prepara terreno para morte marcante na franquia'),
    content: rendered(`<p>Sem pistas.</p><img src="${hotlinks}/external/nunca.jpg" alt="" />`),
    excerpt: rendered('<p>Sem pistas.</p>'),
    author: 2,
    featured_media: 0,
    categories: [9],
    tags: [],
  };
}

function postRows(origin: string, hotlinks: string | null): Record<string, unknown>[] {
  const posts = Array.from({ length: POST_COUNT }, (_, i) => ({
    id: 1000 + i,
    date_gmt: new Date(Date.UTC(2026, 7, 20 + (i % 8), 12)).toISOString().replace('Z', ''),
    modified_gmt: new Date(Date.UTC(2026, 7, 20 + (i % 8), 13)).toISOString().replace('Z', ''),
    slug: `materia-numero-${i}`,
    status: 'publish',
    type: 'post',
    link: `${origin}/2026/08/materia-numero-${i}/`,
    title: rendered(`Matéria número ${i} — acentuação &amp; entidades`),
    content: rendered(body(i, origin, hotlinks)),
    excerpt: rendered(`<p>Resumo da matéria ${i}.</p>`),
    // Numeric ids, exactly as WordPress sends them.
    author: i % 2 === 0 ? 2 : 7,
    featured_media: i % 2 === 0 ? 101 : 102,
    // The desk is second, as in the real archive: WordPress orders by term id and
    // `noticias` (9) is newer here only by construction — what matters is that the
    // importer must not read position 0 as the desk.
    categories: [9, i % 2 === 0 ? 3 : 5],
    tags: i % 3 === 0 ? [11, 12] : [11],
  }));
  return hotlinks === null
    ? posts
    : [...posts, unfiledPost(origin, hotlinks), leftOutPost(origin, hotlinks), copyPost(origin, hotlinks)];
}

export async function startFakeWordPress(port = 0, options: FakeWordPressOptions = {}): Promise<FakeWordPress> {
  // Collections are built after binding, because the media URLs and post links have to
  // name this server's own origin for the asset download to be a real one.
  let collections: Record<string, unknown[]> = {};
  const externalRequests: string[] = [];

  const server: Server = createServer((req, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://wp.local');

    if (options.acervo && url.pathname.startsWith('/external/')) {
      externalRequests.push(`${url.pathname}${url.search}`);
      // Only the rendition the article showed: a download that lost the query string on
      // the way gets the 404 a CDN gives for a size it does not serve.
      if (url.pathname === '/external/capa.jpg' && url.search === '?w=1100&q=80') {
        res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': JPEG.length });
        return res.end(JPEG);
      }
      if (url.pathname === '/external/pagina.jpg') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        return res.end('<!doctype html><title>Página</title>');
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }

    if (url.pathname.startsWith('/wp-content/uploads/')) {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': JPEG.length });
      return res.end(JPEG);
    }

    const rest = /^\/wp-json\/wp\/v2\/([a-z]+)$/.exec(url.pathname);
    if (!rest?.[1] || !(rest[1] in collections)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ code: 'rest_no_route' }));
    }

    const items = collections[rest[1]] ?? [];
    const perPage = Math.min(Math.max(Number(url.searchParams.get('per_page') ?? 10), 1), 100);
    const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1);
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));

    // WordPress answers 400 past the last page, and the importer reads that as the end.
    if (page > totalPages) {
      res.writeHead(400, { 'content-type': 'application/json', 'x-wp-totalpages': String(totalPages) });
      return res.end(JSON.stringify({ code: 'rest_post_invalid_page_number' }));
    }

    const payload = JSON.stringify(items.slice((page - 1) * perPage, page * perPage));
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'x-wp-total': String(items.length),
      'x-wp-totalpages': String(totalPages),
      'content-length': Buffer.byteLength(payload),
    });
    res.end(payload);
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  const origin = `http://127.0.0.1:${boundPort}`;

  collections = {
    posts: postRows(origin, options.acervo ? `http://localhost:${boundPort}` : null),
    categories: CATEGORIES,
    tags: TAGS,
    users: USERS,
    media: mediaRows(origin),
  };

  return {
    url: origin,
    externalRequests,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export const expected = {
  posts: POST_COUNT,
  categories: DESK_CATEGORIES,
  categoriesInWordPress: CATEGORIES.length,
  // Kal El tags: the two real tags plus the category that was demoted into one.
  tags: TAGS.length + (CATEGORIES.length - DESK_CATEGORIES),
  authors: USERS.length,
  media: MEDIA_COUNT,
};
