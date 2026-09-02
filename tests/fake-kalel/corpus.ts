/**
 * A Kal El corpus, in the CMS's own shapes.
 *
 * Not the fixture provider rewritten — the point is the opposite. The fixture provider
 * returns *domain* objects, so every test that uses it skips the DTO schemas, the mapper,
 * the taxonomy hydration and the media proxy. This corpus is written in the shapes
 * `packages/contracts` actually defines: relations as arrays of UUID, body as
 * `{ version: 2, nodes }`, media as rows that only a `media.read` request can turn into
 * bytes. Serving it forces every one of those layers to run.
 *
 * Deterministic on purpose. Ids are derived from a counter, dates from a fixed epoch, so
 * two runs produce byte-identical responses and a diff means a real change.
 */

/** Combining marks left behind by NFD, written as escapes so an editor cannot eat them. */
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Anchored to the moment the corpus is built, not to a fixed date.
 *
 * A frozen epoch looked more deterministic and was quietly wrong: the news sitemap keeps
 * a 48-hour window, so a corpus dated last month renders an empty file and the gate
 * cannot tell that apart from a broken query. Ordering is still fully determined — every
 * row is a whole number of days from this one instant — and nothing here is compared
 * against a stored snapshot, so an absolute date has no one to disagree with.
 */
const EPOCH = Date.now();

function uuid(kind: number, n: number): string {
  const a = kind.toString(16).padStart(8, '0');
  const b = n.toString(16).padStart(4, '0');
  return `${a}-${b}-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

function iso(daysAgo: number): string {
  return new Date(EPOCH - daysAgo * 86_400_000).toISOString();
}

export const SITE_ID = '11111111-2222-4333-8444-555566667777';
export const SERVICE_TOKEN = 'ke_st.fake0000000000000000000000000000';

export interface Row {
  id: string;
  [key: string]: unknown;
}

const DESKS = [
  { slug: 'filmes', name: 'Filmes' },
  { slug: 'series', name: 'Séries' },
  { slug: 'quadrinhos', name: 'Quadrinhos' },
  { slug: 'games', name: 'Games' },
  { slug: 'animes', name: 'Animes' },
  { slug: 'reviews', name: 'Reviews' },
] as const;

export const categories: Row[] = DESKS.map((desk, i) => ({
  id: uuid(0xc0, i),
  siteId: SITE_ID,
  name: desk.name,
  slug: desk.slug,
  description: `Tudo sobre ${desk.name.toLowerCase()}.`,
  parentId: null,
  createdAt: iso(400),
  updatedAt: iso(400),
}));

const TAG_SLUGS = ['marvel', 'netflix', 'longform', 'ao-vivo', 'patrocinado', 'trailer'];

export const tags: Row[] = TAG_SLUGS.map((slug, i) => ({
  id: uuid(0x7a, i),
  siteId: SITE_ID,
  name: slug.replace(/-/g, ' '),
  slug,
  createdAt: iso(400),
  updatedAt: iso(400),
}));

const AUTHOR_NAMES = ['Redação', 'Juliana Prado', 'Marcos Vinícius'];

export const authors: Row[] = AUTHOR_NAMES.map((name, i) => ({
  id: uuid(0xa0, i),
  siteId: SITE_ID,
  name,
  slug: name
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  bio: `${name} escreve para a Máquina Nerd.`,
  // Required-but-nullable in the CMS contract, and the application's schema agrees.
  // Omitting them here is what the fake's self-validation caught on the first run.
  email: null,
  userId: null,
  avatarMediaId: null,
  createdAt: iso(400),
  updatedAt: iso(400),
}));

export const entities: Row[] = [
  {
    id: uuid(0xe0, 0),
    siteId: SITE_ID,
    name: 'Panini',
    type: 'brand',
    description: 'Editora brasileira de quadrinhos.',
    externalRefs: [],
    createdAt: iso(400),
    updatedAt: iso(400),
  },
];

/**
 * More media than one page holds.
 *
 * The repository asks for 200 rows at a time, so a corpus of 24 never makes it ask twice
 * — and a provider that read only the first page would have passed the gate. 260 is the
 * smallest number that forces the second request and proves the `offset`/`total` walk
 * terminates on the right condition.
 */
export const media: Row[] = Array.from({ length: 260 }, (_, i) => ({
  id: uuid(0x0d, i),
  siteId: SITE_ID,
  filename: `capa-${i}.jpg`,
  mimeType: 'image/jpeg',
  sizeBytes: 90_000 + i * 137,
  width: 1600,
  height: 900,
  altText: `Cena da matéria ${i}`,
  caption: i % 3 === 0 ? `Divulgação ${i}` : null,
  credit: i % 4 === 0 ? 'Divulgação' : null,
  focalX: null,
  focalY: null,
  storageKey: `fake/${i}.jpg`,
  provider: 'fake',
  createdBy: null,
  externalKey: `wp:media:${i}`,
  createdAt: iso(i % 90),
  updatedAt: iso(i % 90),
}));

const TITLES = [
  'Resident Evil de 2026 revela mudança em monstro clássico',
  'Netflix revela trailer de LEGO One Piece com aventura inédita',
  'Como Ahsoka virou a série mais ambiciosa do universo Star Wars',
  'Lanterns atinge 9,3 milhões de espectadores na estreia',
  'Cameron Diaz estrela Bad Day, nova comédia de ação',
  '5 coisas que o trailer de Duna 3 já entregou',
  'A década em que a Marvel apostou tudo',
  'Box do Sandman chega ao Brasil com acabamento de luxo',
  'Os 10 melhores box de quadrinhos de 2026',
  'Como montar uma estante de quadrinhos que aguenta o peso',
  'Silksong finalmente tem data e a internet não acredita',
  'O que esperar da próxima temporada de Invincible',
  'Zelda ganha port inesperado e a comunidade reage',
  'Crunchyroll anuncia dublagem simultânea para o outono',
  'James Gunn confirma elenco do próximo capítulo',
  'A HBO prepara spin-off que ninguém pediu — e pode dar certo',
  'Godzilla volta com orçamento recorde',
  'Por que o terror analógico voltou a funcionar',
  'Elden Ring recebe expansão surpresa',
  'O anime que redefiniu a animação 2D neste ano',
];

function paragraph(text: string): Record<string, unknown> {
  return { type: 'paragraph', attrs: {}, content: [{ type: 'text', text, marks: [] }] };
}

function bodyFor(i: number, mediaId: string): Record<string, unknown> {
  const nodes: Record<string, unknown>[] = [
    paragraph(
      `Abertura da matéria ${i}, com contexto suficiente para o resumo e para o primeiro parágrafo renderizado.`,
    ),
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'O que se sabe', marks: [] }] },
    paragraph('Segundo parágrafo, com detalhe adicional sobre o assunto.'),
    {
      type: 'list',
      attrs: { ordered: false },
      content: [
        [{ type: 'text', text: 'Primeiro ponto da lista', marks: [] }],
        [{ type: 'text', text: 'Segundo ponto da lista', marks: [] }],
      ],
    },
    { type: 'image', attrs: { mediaId, caption: 'Cena da produção', credit: 'Divulgação', altText: 'Cena' } },
  ];

  if (i % 5 === 0) {
    nodes.push({
      type: 'embed',
      attrs: { url: 'https://www.youtube.com/watch?v=abc123', provider: 'youtube', id: 'abc123' },
    });
  }
  if (i % 7 === 0) {
    nodes.push({
      type: 'quote',
      attrs: {},
      content: [{ type: 'text', text: 'Uma citação que o mapper precisa preservar.', marks: [] }],
    });
  }
  return { version: 2, nodes };
}

function articleAt(i: number): Row {
  const desk = i % DESKS.length;
  const title = TITLES[i % TITLES.length] ?? `Matéria ${i}`;
  const slug =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(DIACRITICS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) + (i >= TITLES.length ? `-${i}` : '');
  const mediaId = media[i % media.length]?.id ?? '';
  const articleTags: string[] = [];
  if (i % 4 === 0) articleTags.push(uuid(0x7a, 0)); // marvel
  if (i % 3 === 0) articleTags.push(uuid(0x7a, 1)); // netflix
  if (i % 9 === 0) articleTags.push(uuid(0x7a, 2)); // longform
  if (i === 3) articleTags.push(uuid(0x7a, 3)); // ao-vivo
  if (i === 7) articleTags.push(uuid(0x7a, 4)); // patrocinado

  return {
    id: uuid(0xf0, i),
    siteId: SITE_ID,
    type: i % 11 === 0 ? 'review' : i % 13 === 0 ? 'video' : 'article',
    status: 'published',
    title,
    dek: `Linha de apoio da matéria ${i}.`,
    slug,
    excerpt: `Resumo da matéria ${i}, com tamanho suficiente para os cards e para a meta description.`,
    version: 1 + (i % 4),
    externalKey: `wp:post:${1000 + i}`,
    featuredMediaId: mediaId,
    authors: [uuid(0xa0, i % AUTHOR_NAMES.length)],
    categories: [uuid(0xc0, desk)],
    tags: articleTags,
    entities: i === 7 ? [uuid(0xe0, 0)] : [],
    publishedAt: iso(i),
    scheduledAt: null,
    updatedAt: iso(i),
    createdAt: iso(i + 5),
    qualityFlags: [],
    document: bodyFor(i, mediaId),
    seo: {
      seoTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      robotsIndex: 'index',
      robotsFollow: 'follow',
      socialTitle: null,
      socialDescription: null,
      socialImageMediaId: null,
      primaryCategoryId: uuid(0xc0, desk),
    },
    provenance: { system: 'wordpress', sources: [] },
    workflowNote: null,
  };
}

/**
 * More articles than one cursor page holds.
 *
 * The index walk asks for 100 at a time. At 40 the CMS never returns a `nextCursor`, so
 * the cursor branch was dead code as far as the gate was concerned — the same mistake in
 * reverse as the media count. 140 forces a second round trip and a real cursor.
 */
export const articles: Row[] = Array.from({ length: 140 }, (_, i) => articleAt(i));

/** One draft, so preview has something to open that a public read must not reach. */
export const draftArticle: Row = {
  ...articleAt(900),
  id: uuid(0xf0, 900),
  status: 'draft',
  slug: 'rascunho-que-so-o-preview-abre',
  title: 'Rascunho que só o preview abre',
  publishedAt: null,
  // No desk yet, which is the case /preview/[slug] exists for: an article with a
  // category has a canonical URL and the preview redirects to it instead.
  categories: [],
};

export const redirects: Row[] = [
  {
    id: uuid(0x4e, 0),
    siteId: SITE_ID,
    sourcePath: '/2019/07/materia-antiga',
    targetPath: '/filmes/resident-evil-de-2026-revela-mudanca-em-monstro-classico',
    kind: '301',
    createdAt: iso(100),
  },
];

export const all = { categories, tags, authors, entities, media, articles, draftArticle, redirects };
