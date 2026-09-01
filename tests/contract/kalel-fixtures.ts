/**
 * Canonical Kal El responses.
 *
 * Hand-built from the real contract in the Kal El repository
 * (`packages/contracts/src/editorial.ts`, `media.ts`, `seo.ts`) and from what
 * `apps/api/src/routes/site.ts` actually returns. Sanitised: no real token, no real host,
 * no real article.
 */

export const SITE_ID = '11111111-2222-4333-8444-555566667777';

const ISO = '2026-08-27T14:32:00.000-03:00';

export const CATEGORY = {
  id: 'aaaa1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  parentId: null,
  name: 'Séries de TV',
  slug: 'series',
  description: 'Audiência, renovações e streaming.',
  createdAt: ISO,
  updatedAt: ISO,
};

export const TAG = {
  id: 'bbbb1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  name: 'Terror',
  slug: 'terror',
  createdAt: ISO,
  updatedAt: ISO,
};

export const AFFILIATE_TAG = {
  ...TAG,
  id: 'bbbb2222-2222-4333-8444-555566667777',
  name: 'Afiliado',
  slug: 'afiliado',
};

export const AUTHOR = {
  id: 'cccc1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  name: 'Rafael Lima',
  slug: 'rafael-lima',
  bio: 'Cobre cinema e terror.',
  email: null,
  userId: null,
  avatarMediaId: null,
  createdAt: ISO,
  updatedAt: ISO,
};

export const MEDIA = {
  id: 'dddd1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  filename: 'capa.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 240_000,
  width: 1600,
  height: 900,
  altText: 'Cena do reboot',
  caption: 'Austin Abrams em cena.',
  credit: 'Divulgação / Netflix',
  focalX: 0.5,
  focalY: 0.4,
  storageKey: `sites/${SITE_ID}/capa.jpg`,
  provider: 'local',
  createdBy: null,
  externalKey: 'wp:media:99',
  createdAt: ISO,
  updatedAt: ISO,
};

export const ENTITY_BRAND = {
  id: 'eeee1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  name: 'Panini',
  type: 'brand',
  description: null,
  externalRefs: [],
  createdAt: ISO,
  updatedAt: ISO,
};

export const ARTICLE_SUMMARY = {
  id: 'ffff1111-2222-4333-8444-555566667777',
  siteId: SITE_ID,
  type: 'article' as const,
  status: 'published' as const,
  title: 'Resident Evil de 2026 revela mudança em monstro clássico',
  dek: 'Novo material promocional do reboot mostra criatura mutante.',
  slug: 'resident-evil-2026-revela-mudanca-em-monstro-classico',
  excerpt: 'Novo material promocional do reboot mostra criatura mutante com tentáculos.',
  version: 3,
  externalKey: 'wp:post:1234',
  featuredMediaId: MEDIA.id,
  authors: [AUTHOR.id],
  categories: [CATEGORY.id],
  tags: [TAG.id],
  entities: [],
  publishedAt: ISO,
  scheduledAt: null,
  updatedAt: ISO,
  createdAt: ISO,
  qualityFlags: [],
};

export const ARTICLE = {
  ...ARTICLE_SUMMARY,
  document: {
    version: 2 as const,
    nodes: [
      {
        type: 'paragraph' as const,
        attrs: {},
        content: [
          { type: 'text' as const, text: 'Novo material promocional do reboot de ', marks: [] },
          { type: 'text' as const, text: 'Resident Evil', marks: [{ type: 'bold' as const }] },
          { type: 'text' as const, text: ' mostra uma criatura mutante.', marks: [] },
        ],
      },
      {
        type: 'heading' as const,
        attrs: { level: 2 },
        content: [{ type: 'text' as const, text: 'O que muda em relação aos jogos', marks: [] }],
      },
      {
        type: 'list' as const,
        attrs: { ordered: false },
        content: [
          [{ type: 'text' as const, text: 'Design prático ampliado digitalmente', marks: [] }],
          [{ type: 'text' as const, text: 'Aparição única no terceiro ato', marks: [] }],
        ],
      },
      {
        type: 'table' as const,
        attrs: { headers: ['Item', 'Valor'] },
        content: [
          [
            [{ type: 'text' as const, text: 'Páginas', marks: [] }],
            [{ type: 'text' as const, text: '2.000', marks: [] }],
          ],
          [
            [{ type: 'text' as const, text: 'Editora', marks: [] }],
            [{ type: 'text' as const, text: 'Panini', marks: [] }],
          ],
        ],
      },
      { type: 'image' as const, attrs: { mediaId: MEDIA.id, caption: 'Cena', credit: 'Netflix', altText: 'Cena' } },
      {
        type: 'embed' as const,
        attrs: { url: 'https://www.youtube.com/watch?v=abc123', provider: 'youtube', id: 'abc123' },
      },
      { type: 'source' as const, attrs: { label: 'Amazon', url: 'https://www.amazon.com.br/dp/X', kind: 'offer' } },
      {
        type: 'quote' as const,
        attrs: {},
        content: [{ type: 'text' as const, text: 'A ideia nunca foi refazer o jogo.', marks: [] }],
      },
    ],
  },
  seo: {
    seoTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    robotsIndex: 'index' as const,
    robotsFollow: 'follow' as const,
    socialTitle: null,
    socialDescription: null,
    socialImageMediaId: null,
    primaryCategoryId: CATEGORY.id,
  },
  provenance: {
    system: 'wordpress',
    sources: [{ provider: 'wordpress', externalId: '1234', externalUrl: 'https://old.example/post' }],
  },
  workflowNote: null,
};

/** A hostile document: everything here must be dropped or neutralised by the mapper. */
export const HOSTILE_ARTICLE = {
  ...ARTICLE,
  id: 'ffff2222-2222-4333-8444-555566667777',
  slug: 'documento-hostil',
  document: {
    version: 2 as const,
    nodes: [
      {
        type: 'paragraph' as const,
        attrs: {},
        content: [
          {
            type: 'text' as const,
            text: 'clique aqui',
            marks: [{ type: 'link' as const, attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
      {
        type: 'paragraph' as const,
        attrs: {},
        content: [
          {
            type: 'text' as const,
            text: 'link protocolo-relativo',
            marks: [{ type: 'link' as const, attrs: { href: '//evil.example/phish' } }],
          },
        ],
      },
      { type: 'embed' as const, attrs: { url: 'https://evil.example/widget', provider: 'evil' } },
      { type: 'source' as const, attrs: { label: 'x', url: 'data:text/html,<script>alert(1)</script>' } },
      { type: 'image' as const, attrs: { mediaId: '99999999-2222-4333-8444-555566667777' } },
    ],
  },
};
