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
}

const rendered = (html: string) => ({ rendered: html });

const CATEGORIES = [
  { id: 3, name: 'Filmes', slug: 'filmes', description: 'Cinema.', parent: 0, count: 3 },
  { id: 5, name: 'Séries', slug: 'series', description: 'TV.', parent: 0, count: 3 },
];

const TAGS = [
  { id: 11, name: 'Marvel', slug: 'marvel' },
  { id: 12, name: 'Netflix', slug: 'netflix' },
];

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
function body(i: number, origin: string): string {
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
  ].join('\n');
}

function postRows(origin: string): Record<string, unknown>[] {
  return Array.from({ length: POST_COUNT }, (_, i) => ({
    id: 1000 + i,
    date_gmt: new Date(Date.UTC(2026, 7, 20 + (i % 8), 12)).toISOString().replace('Z', ''),
    modified_gmt: new Date(Date.UTC(2026, 7, 20 + (i % 8), 13)).toISOString().replace('Z', ''),
    slug: `materia-numero-${i}`,
    status: 'publish',
    type: 'post',
    link: `${origin}/2026/08/materia-numero-${i}/`,
    title: rendered(`Matéria número ${i} — acentuação &amp; entidades`),
    content: rendered(body(i, origin)),
    excerpt: rendered(`<p>Resumo da matéria ${i}.</p>`),
    // Numeric ids, exactly as WordPress sends them.
    author: i % 2 === 0 ? 2 : 7,
    featured_media: i % 2 === 0 ? 101 : 102,
    categories: [i % 2 === 0 ? 3 : 5],
    tags: i % 3 === 0 ? [11, 12] : [11],
  }));
}

export async function startFakeWordPress(port = 0): Promise<FakeWordPress> {
  // Collections are built after binding, because the media URLs and post links have to
  // name this server's own origin for the asset download to be a real one.
  let collections: Record<string, unknown[]> = {};

  const server: Server = createServer((req, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://wp.local');

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
    posts: postRows(origin),
    categories: CATEGORIES,
    tags: TAGS,
    users: USERS,
    media: mediaRows(origin),
  };

  return {
    url: origin,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export const expected = {
  posts: POST_COUNT,
  categories: CATEGORIES.length,
  tags: TAGS.length,
  authors: USERS.length,
  media: MEDIA_COUNT,
};
