import { describe, expect, it } from 'vitest';

import { editorialUpdatedAt, fixtureArticles, type Article } from '@mn/content';
import { articleMetadata, articleNode, coverVariant, sitemapIndex, urlSet, type SeoContext } from '@mn/seo';

/**
 * What the SEO diagnosis of 2026-09-21 found in the structured data and the metadata, and
 * must not find again (docs/migration/SEO-DIAGNOSTICO.md §3.3).
 */

const ctx: SeoContext = {
  siteUrl: 'https://www.maquinanerd.com.br',
  siteName: 'Máquina Nerd',
  logoUrl: '/brand/mn-logo-on-light.png',
  sameAs: [],
};

const MEDIA_ID = '0c50acf8-0d68-4131-a721-b85b2691edcb';

function article(overrides: Partial<Article> = {}): Article {
  const base = fixtureArticles.find((a) => a.layout !== 'offer' && a.category !== null) as Article;
  return {
    ...base,
    cover: { url: `/media/${MEDIA_ID}`, width: 3200, height: 1800, alt: 'Cena de Lanterns' },
    ...overrides,
  };
}

describe('the cover Google and the social networks get', () => {
  it('crops a CMS cover in the three ratios Google asks for, 1200 px wide, as JPEG', () => {
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 3200 }, '16x9')).toEqual({
      url: `/media/${MEDIA_ID}/16x9.jpg`,
      width: 1200,
      height: 675,
    });
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 3200 }, '1x1')?.height).toBe(1200);
  });

  it('leaves alone a cover that is not a CMS image, or is too small to crop', () => {
    expect(coverVariant({ url: '/brand/og-default.jpg', width: 1200 }, '16x9')).toBeNull();
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 400 }, '16x9')).toBeNull();
  });

  it('declares the three crops as the Article image', () => {
    const images = articleNode(ctx, article())['image'] as { url: string; width: number; height: number }[];
    expect(images.map((i) => i.url)).toEqual([
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/16x9.jpg`,
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/4x3.jpg`,
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/1x1.jpg`,
    ]);
    for (const image of images) expect(image.width).toBeGreaterThanOrEqual(1200);
  });

  it('shares the 16:9 JPEG, never the AVIF original', () => {
    const base = article();
    const images = articleMetadata(ctx, { ...base, seo: { ...base.seo, ogImage: undefined } }).openGraph?.images as {
      url: string;
      type?: string;
    }[];
    expect(images[0]?.url).toBe(`https://www.maquinanerd.com.br/media/${MEDIA_ID}/16x9.jpg`);
    expect(images[0]?.type).toBe('image/jpeg');
  });
});

describe('who signs the article', () => {
  it('is the newsroom itself when the article has no author, never an empty list', () => {
    expect(articleNode(ctx, article({ authors: [] }))['author']).toEqual([
      { '@id': 'https://www.maquinanerd.com.br/#organization' },
    ]);
  });

  it('carries an author\x27s profiles as sameAs', () => {
    const [person] = articleNode(
      ctx,
      article({
        authors: [{ id: 'a1', name: 'Juliana Prado', slug: 'juliana-prado', social: { x: 'https://x.com/juliana' } }],
      }),
    )['author'] as Record<string, unknown>[];
    expect(person).toMatchObject({ '@type': 'Person', sameAs: ['https://x.com/juliana'] });
  });
});

describe('when the article changed', () => {
  it('is the last edit, or the publication — never the import', () => {
    const imported = article({
      publishedAt: '2026-08-19T15:04:54.000Z',
      updatedAt: '2026-09-21T22:10:00.000Z',
      editedAt: null,
    });
    expect(articleNode(ctx, imported)['dateModified']).toBe('2026-08-19T15:04:54.000Z');
    expect((articleMetadata(ctx, imported).openGraph as { modifiedTime?: string }).modifiedTime).toBe(
      '2026-08-19T15:04:54.000Z',
    );

    const edited = article({ ...imported, editedAt: '2026-10-02T14:00:00.000Z' });
    expect(articleNode(ctx, edited)['dateModified']).toBe('2026-10-02T14:00:00.000Z');
  });

  it('gives the sitemap the same answer for an article rewritten by an import session', () => {
    expect(editorialUpdatedAt({ publishedAt: '2026-08-19T15:04:54Z', updatedAt: '2026-09-17T21:45:07Z' })).toBe(
      '2026-08-19T15:04:54Z',
    );
    expect(editorialUpdatedAt({ publishedAt: '2026-08-19T15:04:54Z', updatedAt: '2026-10-02T14:00:00Z' })).toBe(
      '2026-10-02T14:00:00Z',
    );
    // A story the newsroom published inside a window keeps its own edits.
    expect(editorialUpdatedAt({ publishedAt: '2026-09-22T09:00:00Z', updatedAt: '2026-09-23T11:00:00Z' })).toBe(
      '2026-09-23T11:00:00Z',
    );
  });
});

describe('what the page announces', () => {
  it('keeps the RSS feed in the head of an article, which sets its own canonical', () => {
    expect(articleMetadata(ctx, article()).alternates?.types).toEqual({
      'application/rss+xml': 'https://www.maquinanerd.com.br/feed.xml',
    });
  });
});

describe('sitemaps say when a page changed only if they know', () => {
  it('writes no lastmod in the index, which does not read its children', () => {
    const xml = sitemapIndex(ctx, ['/sitemap/articles-1.xml']);
    expect(xml).toContain('<loc>https://www.maquinanerd.com.br/sitemap/articles-1.xml</loc>');
    expect(xml).not.toContain('<lastmod>');
  });

  it('writes a lastmod only for an entry that has one', () => {
    const xml = urlSet(ctx, [
      { path: '/tag/marvel' },
      { path: '/cinema/uma-materia', lastModified: '2026-08-19T15:04:54.000Z' },
    ]);
    expect(xml).toContain('<url><loc>https://www.maquinanerd.com.br/tag/marvel</loc></url>');
    expect(xml).toMatch(/uma-materia<\/loc><lastmod>2026-08-19/);
  });
});
