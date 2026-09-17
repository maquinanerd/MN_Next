import { describe, expect, it } from 'vitest';

import { planRun } from '../../scripts/wp/plan';
import type { WpMedia, WpPost } from '../../scripts/wp/source';

/**
 * The pass over the posts before anything is written. What it decides changes what the run
 * writes, so each answer is pinned here: which posts are copies, which third-party images
 * the imported posts show (once each, not once per copy), and which missing files an
 * imported post actually uses — a skipped copy's cover not included.
 */

const SITE = 'https://www.maquinanerd.com.br';

const asset = (id: number, file: string): WpMedia => ({
  id,
  slug: `asset-${id}`,
  source_url: `${SITE}/wp-content/uploads/${file}`,
  mime_type: 'image/jpeg',
  alt_text: '',
  media_details: { width: 1200, height: 675 },
});

const post = (id: number, over: Partial<WpPost> = {}): WpPost => ({
  id,
  date_gmt: '2025-07-27T18:18:17',
  modified_gmt: '2025-07-27T18:18:17',
  slug: `post-${id}`,
  status: 'publish',
  type: 'post',
  link: `${SITE}/post-${id}/`,
  title: `Título ${id}`,
  content: `<p>Corpo ${id}.</p>`,
  excerpt: '',
  author: 1,
  featured_media: 0,
  categories: [20],
  tags: [],
  ...over,
});

async function* batches(...groups: WpPost[][]): AsyncGenerator<WpPost[]> {
  for (const group of groups) yield group;
}

const library = [asset(10, '2025/07/capa.jpg'), asset(11, '2025/07/corpo.jpg'), asset(12, '2025/07/capa-copia.jpg')];

const sharedBody = [
  '<p>Texto da matéria.</p>',
  `<img src="https://static0.srcdn.com/wordpress/wp-content/uploads/2025/07/cena.jpg" alt="Cena" />`,
  `<img src="${SITE}/wp-content/uploads/2025/07/corpo-800x450.jpg" alt="" />`,
].join('\n');

describe('planRun', () => {
  it('finds the copy, collects its third-party image once, and does not count a copy among the users of a missing file', async () => {
    const original = post(9880, { title: 'Bomba!', content: sharedBody, featured_media: 10 });
    const copy = post(9886, {
      title: 'Bomba!',
      content: sharedBody,
      featured_media: 12,
      slug: 'post-9880-2',
      link: `${SITE}/post-9880-2/`,
    });
    const other = post(1, { featured_media: 11 });

    const plan = await planRun({
      // The copy arrives first: order must not decide which one is kept.
      posts: batches([copy], [other, original]),
      limit: 0,
      willBeFiled: () => true,
      library,
      collectExternal: true,
      missingOnDisk: new Set([10, 11, 12]),
      siteHost: 'www.maquinanerd.com.br',
    });

    expect(plan.duplicates).toEqual([
      { skippedId: 9886, keptId: 9880, legacyPath: '/post-9880-2/', keptLegacyPath: '/post-9880/' },
    ]);
    expect(plan.externalImages.map((i) => [i.host, i.occurrences])).toEqual([['static0.srcdn.com', 1]]);
    // 10 is the original's cover, 11 its body image and post 1's cover; 12 only the copy's.
    expect(Object.fromEntries([...plan.missingUsedBy].map(([id, posts]) => [id, [...posts].sort()]))).toEqual({
      10: [9880],
      11: [1, 9880],
    });
  });

  it('ignores posts that will not be imported, and plans nothing about files when none are missing', async () => {
    const plan = await planRun({
      posts: batches([post(5, { content: sharedBody, featured_media: 10 })]),
      limit: 0,
      willBeFiled: () => false,
      library,
      collectExternal: true,
      missingOnDisk: null,
      siteHost: 'www.maquinanerd.com.br',
    });
    expect(plan).toMatchObject({ duplicates: [], externalImages: [] });
    expect(plan.missingUsedBy.size).toBe(0);
  });

  it('stops at the limit', async () => {
    const plan = await planRun({
      posts: batches([post(1, { title: 'A', content: 'x' }), post(2, { title: 'A', content: 'x' })]),
      limit: 1,
      willBeFiled: () => true,
      library,
      collectExternal: false,
      missingOnDisk: null,
    });
    expect(plan.duplicates).toEqual([]);
  });
});
