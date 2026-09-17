import { describe, expect, it } from 'vitest';

import type { Image } from '@mn/content';

import {
  ExternalImageCollector,
  decodeAttribute,
  externalImageHash,
  externalImageKey,
  externalImageUrl,
  publisherOf,
} from '../../scripts/wp/external-images';
import { emptyIndexes, imageResolver } from '../../scripts/wp/import';
import { emptyReport, htmlToBlocks, type TransformReport } from '../../scripts/wp/transform';

/**
 * Collecting hotlinked images, through the transform that will later look them up.
 *
 * The property everything else rests on: a URL collected here is found again, under the
 * same spelling, when the post is converted for real. Every case runs the actual
 * `htmlToBlocks` — sanitiser included — rather than a hand-written parse of a body.
 */

const SITE = 'www.maquinanerd.com.br';

function collect(posts: { id: number; html: string }[], resolve: (src: string) => Image | null = () => null) {
  const collector = new ExternalImageCollector();
  const report: TransformReport = emptyReport();
  for (const post of posts) {
    htmlToBlocks(post.html, {
      postId: post.id,
      report,
      resolveImage: resolve,
      siteHost: SITE,
      onUnresolvedImage: collector.listener(post.id),
    });
  }
  return { collector, report };
}

describe('the URL a reader’s browser requested', () => {
  it('keeps the query string, which is the rendition the article showed', () => {
    expect(
      externalImageUrl('https://static0.srcdn.com/wordpress/wp-content/uploads/a.jpg?q=50&amp;fit=crop&amp;w=1100'),
    ).toBe('https://static0.srcdn.com/wordpress/wp-content/uploads/a.jpg?q=50&fit=crop&w=1100');
  });

  it('does not fold a size suffix into the original, as it does for the library', () => {
    expect(externalImageUrl('https://variety.com/wp-content/uploads/2024/05/poster-1024x576.jpg')).toBe(
      'https://variety.com/wp-content/uploads/2024/05/poster-1024x576.jpg',
    );
  });

  it('reads `&#038;` as the ampersand it is, not as the start of a fragment', () => {
    // Undecoded, `#038;h=2` parses as a fragment — never sent — and the download asks
    // for a different image than the page showed.
    expect(externalImageUrl('https://cdn.test/a.jpg?w=1&amp;#038;h=2')).toBe('https://cdn.test/a.jpg?w=1&h=2');
  });

  it('decodes exactly one level more than the sanitiser added, like a browser', () => {
    // WordPress wrote `&amp;amp;`: the browser read `&amp;` and requested it literally.
    expect(externalImageUrl('https://cdn.test/a.jpg?w=1&amp;amp;amp;h=2')).toBe('https://cdn.test/a.jpg?w=1&amp;h=2');
    expect(decodeAttribute('&lt;&#x26;&#38;&quot;&apos;&nbsp;&bogus;')).toBe('<&&"\'\u00a0&bogus;');
  });

  it('drops the fragment, which no server ever sees', () => {
    expect(externalImageUrl('https://cdn.test/a.jpg?w=1#top')).toBe('https://cdn.test/a.jpg?w=1');
  });

  it('refuses what is not an http URL', () => {
    expect(externalImageUrl('javascript:alert(1)')).toBeNull();
    expect(externalImageUrl('/wp-media-id/12')).toBeNull();
  });
});

describe('the external key', () => {
  it('is stable, prefixed and within what Kal El stores', () => {
    const url = 'https://variety.com/a.jpg?w=1';
    const key = externalImageKey(externalImageHash(url));
    expect(key).toBe(externalImageKey(externalImageHash(url)));
    expect(key).toMatch(/^wp:external:[0-9a-f]{32}$/);
    expect(key.length).toBeLessThanOrEqual(200);
    expect(externalImageKey(externalImageHash('https://variety.com/a.jpg?w=2'))).not.toBe(key);
  });
});

describe('collection', () => {
  it('collects only images the transform itself calls external', () => {
    const { collector, report } = collect([
      {
        id: 1,
        html:
          `<p>a</p><img src="https://${SITE}/wp-content/uploads/2024/01/nossa.jpg" alt="" />` +
          '<img src="/wp-media-id/12" alt="" />' +
          '<img src="https://variety.com/a.jpg" alt="De fora" />' +
          '<img src="https://lumiere-a. akamaihd.net/x.jpg" alt="" />',
      },
    ]);
    expect(collector.images().map((i) => i.url)).toEqual(['https://variety.com/a.jpg']);
    // The same number the report puts under `image:external:<host>`.
    expect(report.unknown['image:external:variety.com']).toBe(1);
  });

  it('never collects an image the library answers for', () => {
    const library: Image = { url: '/media/abc', width: 1, height: 1, alt: '' };
    const { collector } = collect([{ id: 1, html: '<img src="https://cdn.test/x.jpg" alt="" />' }], () => library);
    expect(collector.images()).toEqual([]);
  });

  it('is one image, one key and one download however many posts and spellings show it', () => {
    const { collector } = collect([
      { id: 10, html: '<img src="https://cdn.test/a.jpg?w=1100&#038;q=80" alt="" />' },
      { id: 11, html: '<img src="https://cdn.test/a.jpg?w=1100&amp;q=80" alt="Uma cena" />' },
      { id: 12, html: '<img src="https://cdn.test/a.jpg?w=1100&q=80" alt="Outra descrição" />' },
    ]);
    const images = collector.images();
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      url: 'https://cdn.test/a.jpg?w=1100&q=80',
      host: 'cdn.test',
      occurrences: 3,
      firstPostId: 10,
      // The first alt that says something: post 10 had none.
      alt: 'Uma cena',
    });
    expect(images[0]?.srcs).toHaveLength(3);
  });

  it('collects under the spelling the resolver is later asked about', () => {
    const html =
      '<p>texto</p><figure><img src="https://cdn.test/b.jpg?a=1&#038;b=2" alt="Legendada" /><figcaption>Crédito</figcaption></figure>';
    const { collector } = collect([{ id: 1, html }]);

    // Register what was collected exactly as the import does, then convert for real.
    const indexes = emptyIndexes();
    for (const image of collector.images()) {
      for (const src of image.srcs)
        indexes.imageByUrl.set(src, { url: '/media/ext', width: 1, height: 1, alt: image.alt });
    }
    const report = emptyReport();
    const blocks = htmlToBlocks(html, { postId: 1, report, resolveImage: imageResolver(indexes), siteHost: SITE });

    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('the collected image was not found again');
    expect(image.image).toMatchObject({ url: '/media/ext', alt: 'Legendada', caption: 'Crédito' });
    expect(report.unknown['image:external:cdn.test']).toBeUndefined();
  });
});

describe('publisherOf', () => {
  it.each([
    ['static0.srcdn.com', 'Screen Rant'],
    ['STATIC0.SRCDN.COM', 'Screen Rant'],
    ['static0.gamerantimages.com', 'Game Rant'],
    ['www.hollywoodreporter.com', 'The Hollywood Reporter'],
    ['cdn.polygon.com', 'Polygon'],
    ['i0.wp.com', 'i0.wp.com'],
    ['www.ign.com', 'ign.com'],
    ['static1.somecdn.net', 'somecdn.net'],
    ['localhost', 'localhost'],
  ])('credits %s as %s', (host, name) => {
    expect(publisherOf(host)).toBe(name);
  });
});
