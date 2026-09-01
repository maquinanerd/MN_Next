import { describe, expect, it } from 'vitest';

import type { Author, Category, Image, Tag } from '@mn/content';
import {
  isBrandUnsafe,
  mapArticle,
  mapArticleSummary,
  mapAuthor,
  mapCategory,
  mapDocument,
  mapMedia,
  mapTag,
  resolveSchemaType,
  resolveTemplate,
  type MapperContext,
} from '../../packages/content/src/kalel/mapper';
import { kalelArticleSchema } from '../../packages/content/src/kalel/dto';
import { AFFILIATE_TAG, ARTICLE, AUTHOR, CATEGORY, ENTITY_BRAND, HOSTILE_ARTICLE, MEDIA, TAG } from './kalel-fixtures';

/**
 * The mapper is the whole isolation boundary between the CMS and the site. These tests
 * assert both halves of its job: that valid CMS content becomes correct domain content,
 * and that hostile CMS content becomes *nothing* rather than an escape hatch.
 */

function context(overrides: Partial<MapperContext> = {}): MapperContext {
  const category: Category = mapCategory(CATEGORY);
  const tag: Tag = mapTag(TAG);
  const affiliate: Tag = mapTag(AFFILIATE_TAG);
  const author: Author = mapAuthor(AUTHOR);
  const image: Image = mapMedia(MEDIA);
  return {
    categories: new Map([[category.id, category]]),
    tags: new Map([
      [tag.id, tag],
      [affiliate.id, affiliate],
    ]),
    authors: new Map([[author.id, author]]),
    media: new Map([[MEDIA.id, image]]),
    entities: new Map([[ENTITY_BRAND.id, ENTITY_BRAND]]),
    ...overrides,
  };
}

describe('the fixtures satisfy the real Kal El schema', () => {
  it('parses the canonical article', () => {
    expect(kalelArticleSchema.safeParse(ARTICLE).success).toBe(true);
  });

  it('parses the hostile article - it is well-formed, just malicious', () => {
    expect(kalelArticleSchema.safeParse(HOSTILE_ARTICLE).success).toBe(true);
  });
});

describe('taxonomy mapping', () => {
  it('derives avatar initials and a stable colour from the author id', () => {
    const first = mapAuthor(AUTHOR);
    const second = mapAuthor(AUTHOR);
    expect(first.initials).toBe('RL');
    expect(first.avatarColor).toBe(second.avatarColor);
    expect(first.avatarColor.startsWith('var(--mn-author-')).toBe(true);
  });

  it('substitutes an empty description rather than null', () => {
    expect(mapCategory({ ...CATEGORY, description: null }).description).toBe('');
  });

  it('assumes 16:9 when the CMS has no dimensions, so layout is still reserved', () => {
    const image = mapMedia({ ...MEDIA, width: null, height: null });
    expect(image.width).toBe(1200);
    expect(image.height).toBe(675);
  });

  it('routes media through the proxy path, never the CMS URL', () => {
    expect(mapMedia(MEDIA).url).toBe(`/media/${MEDIA.id}`);
  });
});

describe('mapDocument', () => {
  const ctx = context();

  it('preserves inline marks instead of flattening to text', () => {
    const { blocks } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    const paragraph = blocks.find((b) => b.type === 'paragraph');
    expect(paragraph).toBeDefined();
    if (paragraph?.type !== 'paragraph') throw new Error('expected a paragraph');
    expect(paragraph.content.some((n) => n.type === 'text' && n.marks.some((m) => m.type === 'bold'))).toBe(true);
  });

  it('gives every heading a stable anchor id', () => {
    const { blocks } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    const heading = blocks.find((b) => b.type === 'heading');
    if (heading?.type !== 'heading') throw new Error('expected a heading');
    expect(heading.id).toBe('o-que-muda-em-relacao-aos-jogos');
  });

  it('reads a two-column table as a spec sheet', () => {
    const { blocks } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    const spec = blocks.find((b) => b.type === 'specTable');
    if (spec?.type !== 'specTable') throw new Error('expected a specTable');
    expect(spec.rows).toEqual([
      { label: 'Páginas', value: '2.000' },
      { label: 'Editora', value: 'Panini' },
    ]);
  });

  it('resolves an image node against the media index', () => {
    const { blocks } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('expected an image');
    expect(image.image.url).toBe(`/media/${MEDIA.id}`);
    expect(image.image.credit).toBe('Netflix');
  });

  it('normalises a known embed provider', () => {
    const { blocks } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    const embed = blocks.find((b) => b.type === 'embed');
    if (embed?.type !== 'embed') throw new Error('expected an embed');
    expect(embed.provider).toBe('youtube');
  });

  it('counts words so reading time is derived, not typed', () => {
    const { wordCount } = mapDocument(ARTICLE.document.nodes, { media: ctx.media });
    expect(wordCount).toBeGreaterThan(10);
  });

  describe('hostile input', () => {
    const { blocks, unknown } = mapDocument(HOSTILE_ARTICLE.document.nodes, { media: ctx.media });
    const serialised = JSON.stringify(blocks);

    it('drops a javascript: link mark but keeps the words', () => {
      expect(serialised).not.toContain('javascript:');
      expect(serialised).toContain('clique aqui');
    });

    it('drops a protocol-relative link', () => {
      expect(serialised).not.toContain('//evil.example');
      expect(serialised).toContain('link protocolo-relativo');
    });

    it('drops an embed from an unknown provider and counts it', () => {
      expect(serialised).not.toContain('evil.example/widget');
      expect(unknown['embed:evil']).toBe(1);
    });

    it('drops a data: source URL', () => {
      expect(serialised).not.toContain('data:text/html');
    });

    it('counts a missing media reference instead of rendering a broken image', () => {
      expect(unknown['image:missing-media']).toBe(1);
    });

    it('never loses a node silently - everything dropped is counted', () => {
      expect(Object.values(unknown).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });
  });
});

describe('template and schema resolution', () => {
  it('maps the CMS type when no presentation tag is present', () => {
    expect(resolveTemplate({ ...ARTICLE, type: 'video' }, [])).toBe('video');
    expect(resolveTemplate({ ...ARTICLE, type: 'list' }, [])).toBe('list');
    expect(resolveTemplate({ ...ARTICLE, type: 'article' }, [])).toBe('standard');
  });

  it('honours the reserved longform and live tags the CMS cannot express', () => {
    expect(resolveTemplate(ARTICLE, [{ id: '1', slug: 'longform', name: 'Longform' }])).toBe('longform');
    expect(resolveTemplate(ARTICLE, [{ id: '2', slug: 'ao-vivo', name: 'Ao vivo' }])).toBe('urgent');
  });

  it('picks the schema type each template needs', () => {
    expect(resolveSchemaType('standard', 'article')).toBe('NewsArticle');
    expect(resolveSchemaType('longform', 'article')).toBe('Article');
    expect(resolveSchemaType('urgent', 'article')).toBe('LiveBlogPosting');
    expect(resolveSchemaType('list', 'list')).toBe('ItemList');
    expect(resolveSchemaType('standard', 'review')).toBe('Review');
  });
});

describe('mapArticleSummary', () => {
  it('produces a linkable summary with resolved taxonomy', () => {
    const summary = mapArticleSummary(ARTICLE, context());
    expect(summary).not.toBeNull();
    expect(summary?.category?.slug).toBe('series');
    expect(summary?.authors[0]?.name).toBe('Rafael Lima');
    expect(summary?.kicker).toBe('Séries de TV');
    expect(summary?.cover?.url).toBe(`/media/${MEDIA.id}`);
  });

  it('returns null when the article has no slug, so no card can 404', () => {
    expect(mapArticleSummary({ ...ARTICLE, slug: null }, context())).toBeNull();
  });

  it('tolerates taxonomy ids the index does not contain', () => {
    const summary = mapArticleSummary({ ...ARTICLE, tags: ['99999999-2222-4333-8444-555566667777'] }, context());
    expect(summary?.tags).toEqual([]);
  });
});

describe('mapArticle', () => {
  it('builds SEO defaults from the article when the CMS leaves them empty', () => {
    const result = mapArticle(ARTICLE, context());
    expect(result?.article.seo.title).toBe(ARTICLE.title);
    expect(result?.article.seo.description).toBe(ARTICLE.excerpt);
    expect(result?.article.seo.noindex).toBe(false);
  });

  it('honours an explicit noindex from the CMS', () => {
    const result = mapArticle({ ...ARTICLE, seo: { ...ARTICLE.seo, robotsIndex: 'noindex' as const } }, context());
    expect(result?.article.seo.noindex).toBe(true);
  });

  it('derives commercial metadata from the reserved tag and brand entity', () => {
    const result = mapArticle({ ...ARTICLE, tags: [AFFILIATE_TAG.id], entities: [ENTITY_BRAND.id] }, context());
    expect(result?.article.commercial?.kind).toBe('affiliate');
    expect(result?.article.commercial?.brandName).toBe('Panini');
    expect(result?.article.commercial?.disclosure).toContain('afiliados');
  });

  it('recomputes reading time from the document', () => {
    const result = mapArticle(ARTICLE, context());
    expect(result?.article.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('isBrandUnsafe', () => {
  it('flags an article tagged for a sensitive subject', () => {
    expect(isBrandUnsafe([{ id: '1', slug: 'tragedia', name: 'Tragédia' }])).toBe(true);
  });

  it('leaves ordinary articles monetisable', () => {
    expect(isBrandUnsafe([mapTag(TAG)])).toBe(false);
  });
});
