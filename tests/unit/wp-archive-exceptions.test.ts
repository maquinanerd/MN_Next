import { describe, expect, it } from 'vitest';

import { slugify } from '@mn/content';

import { ArchiveExceptions } from '../../scripts/wp/build-redirects';
import type { WpPost } from '../../scripts/wp/source';

/**
 * The redirects the runtime rule cannot answer. A legacy `/{slug}/` whose slug is the
 * article's is resolved at request time; everything else needs an entry — including the
 * `-2` URL of a copy the importer skips, which must land on the article it copies.
 */

const SITE = 'https://www.maquinanerd.com.br';
const LONG =
  'bomba-vanessa-kirby-revela-robert-downey-jr-como-doutor-destino-em-cena-pos-creditos-de-quarteto-fantastico-primeiros-passos';

const post = (id: number, slug: string, over: Partial<WpPost> = {}): WpPost => ({
  id,
  date_gmt: '2025-07-27T18:18:17',
  modified_gmt: '2025-07-27T18:18:17',
  slug,
  status: 'publish',
  type: 'post',
  link: `${SITE}/${slug}/`,
  title: `Título ${id}`,
  content: `<p>Corpo ${id}.</p>`,
  excerpt: '',
  author: 1,
  featured_media: 0,
  categories: [20],
  tags: [],
  ...over,
});

describe('ArchiveExceptions', () => {
  it('sends the legacy URL of a skipped copy to the final address of the post it copies', () => {
    const exceptions = new ArchiveExceptions();
    const title = 'Bomba! Vanessa Kirby revela Robert Downey Jr.';
    exceptions.add(post(9880, LONG, { title, content: '<p>igual</p>' }), 'cinema');
    exceptions.add(post(9886, `${LONG}-2`, { title, content: '<p>igual</p>' }), 'cinema');

    const result = exceptions.result();
    const target = `/cinema/${slugify(LONG)}`;
    expect(result.duplicates).toBe(1);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        // The original is past slugify's 120 characters, so it needs its own entry too.
        { from: `/${LONG}`, to: target },
        { from: `/${LONG}-2`, to: target },
      ]),
    );
    expect(result.entries).toHaveLength(2);
  });

  it('adds nothing for a copy that shares the legacy URL of the post it copies', () => {
    const exceptions = new ArchiveExceptions();
    const same = { title: 'Kick-Ass: 7 diferenças', content: '<p>igual</p>' };
    exceptions.add(post(11001, 'kick-ass-7-diferencas', same), 'cinema');
    exceptions.add(post(11002, 'kick-ass-7-diferencas', same), 'cinema');

    const result = exceptions.result();
    expect(result).toMatchObject({ entries: [], duplicates: 0, coveredByRule: 1 });
  });

  it('leaves two different stories alone, whatever their slugs', () => {
    const exceptions = new ArchiveExceptions();
    exceptions.add(post(1, 'superman-bilheteria', { title: 'Superman A', content: '<p>a</p>' }), 'cinema');
    exceptions.add(post(2, 'superman-bilheteria-2', { title: 'Superman B', content: '<p>b</p>' }), 'cinema');
    expect(exceptions.result()).toMatchObject({ entries: [], duplicates: 0, coveredByRule: 2 });
  });
});
