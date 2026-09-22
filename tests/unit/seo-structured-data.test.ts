import { describe, expect, it } from 'vitest';

import { editorialUpdatedAt, fixtureArticles, type Article } from '@mn/content';
import {
  articleMetadata,
  articleNode,
  coverVariant,
  parseRenditionFile,
  sitemapIndex,
  socialVariant,
  urlSet,
  type SeoContext,
} from '@mn/seo';

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
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 3200, height: 1800 }, '16x9')).toEqual({
      url: `/media/${MEDIA_ID}/16x9-v1.jpg`,
      width: 1200,
      height: 675,
    });
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 3200, height: 1800 }, '1x1')?.height).toBe(1200);
  });

  it('leaves alone a cover that is not a CMS image, or is too small to crop', () => {
    expect(coverVariant({ url: '/brand/og-default.jpg', width: 1200, height: 630 }, '16x9')).toBeNull();
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 400, height: 225 }, '16x9')).toBeNull();
    // A size the CMS never recorded cannot be checked against the decode limit.
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 3200, height: 0 }, '16x9')).toBeNull();
  });

  it('publishes no rendition of an original the route would refuse to decode', () => {
    // 8000 × 6000 is a 48 MP phone photo: past the route's limit, so the original is used.
    expect(coverVariant({ url: `/media/${MEDIA_ID}`, width: 8000, height: 6000 }, '16x9')).toBeNull();
    expect(socialVariant({ url: `/media/${MEDIA_ID}`, width: 8000, height: 6000 })).toBeNull();
    const huge = article({ cover: { url: `/media/${MEDIA_ID}`, width: 8000, height: 6000, alt: 'Foto' } });
    expect(articleNode(ctx, huge)['image']).toMatchObject({ url: `https://www.maquinanerd.com.br/media/${MEDIA_ID}` });
  });

  it('declares the three crops as the Article image', () => {
    const images = articleNode(ctx, article())['image'] as { url: string; width: number; height: number }[];
    expect(images.map((i) => i.url)).toEqual([
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/16x9-v1.jpg`,
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/4x3-v1.jpg`,
      `https://www.maquinanerd.com.br/media/${MEDIA_ID}/1x1-v1.jpg`,
    ]);
    for (const image of images) expect(image.width).toBeGreaterThanOrEqual(1200);
  });

  it('shares the 16:9 JPEG, never the AVIF original', () => {
    const base = article();
    const images = articleMetadata(ctx, { ...base, seo: { ...base.seo, ogImage: undefined } }).openGraph?.images as {
      url: string;
      type?: string;
    }[];
    expect(images[0]?.url).toBe(`https://www.maquinanerd.com.br/media/${MEDIA_ID}/16x9-v1.jpg`);
    expect(images[0]?.type).toBe('image/jpeg');
  });
});

describe('the renditions the media route draws', () => {
  it('are named with their version, and nothing else is one', () => {
    expect(parseRenditionFile('16x9-v1.jpg')).toBe('16x9');
    expect(parseRenditionFile('social-v1.jpg')).toBe('social');
    // An old version, an unversioned name, another format or ratio: not drawn.
    for (const name of [
      '16x9.jpg',
      '16x9-v0.jpg',
      '16x9-v1.png',
      '2x1-v1.jpg',
      'constructor-v1.jpg',
      '../16x9-v1.jpg',
    ]) {
      expect(parseRenditionFile(name), name).toBeNull();
    }
  });

  it('keep a share image in its own proportions, at most 1200 px wide', () => {
    expect(socialVariant({ url: `/media/${MEDIA_ID}`, width: 2400, height: 1260 })).toEqual({
      url: `/media/${MEDIA_ID}/social-v1.jpg`,
      width: 1200,
      height: 630,
    });
    expect(socialVariant({ url: `/media/${MEDIA_ID}`, width: 800, height: 600 })).toMatchObject({
      width: 800,
      height: 600,
    });
    expect(socialVariant({ url: `/media/${MEDIA_ID}`, width: 400, height: 300 })).toBeNull();
  });

  it('share the image the newsroom made for sharing uncropped, and the cover as its 16:9 crop', () => {
    const base = article();
    const social = { url: '/media/5e1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6b', width: 1200, height: 630, alt: 'Arte' };
    const picked = articleMetadata(ctx, { ...base, seo: { ...base.seo, ogImage: social } }).openGraph?.images as {
      url: string;
      height?: number;
    }[];
    expect(picked[0]).toMatchObject({ url: `https://www.maquinanerd.com.br${social.url}/social-v1.jpg`, height: 630 });

    const cover = articleMetadata(ctx, { ...base, seo: { ...base.seo, ogImage: base.cover ?? undefined } }).openGraph
      ?.images as { url: string }[];
    expect(cover[0]?.url).toBe(`https://www.maquinanerd.com.br/media/${MEDIA_ID}/16x9-v1.jpg`);
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
    const imported = { publishedAt: '2026-08-19T15:04:54Z', externalKey: 'wp:post:48213' };
    expect(editorialUpdatedAt({ ...imported, updatedAt: '2026-09-17T21:45:07Z' })).toBe('2026-08-19T15:04:54Z');
    expect(editorialUpdatedAt({ ...imported, updatedAt: '2026-11-02T14:00:00Z' })).toBe('2026-11-02T14:00:00Z');
    // A story the newsroom published in Kal El keeps its own edits, inside a window or not.
    expect(
      editorialUpdatedAt({ publishedAt: '2026-09-19T09:00:00Z', updatedAt: '2026-09-23T11:00:00Z', externalKey: null }),
    ).toBe('2026-09-23T11:00:00Z');
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
