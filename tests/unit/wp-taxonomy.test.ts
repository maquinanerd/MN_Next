import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DESK_SLUGS } from '@mn/content';

import { DESK_PRECEDENCE, classifyCategory, deskFor, deskOf, loadCategoryMap } from '../../scripts/wp/taxonomy';

/**
 * 8.619 WordPress categories onto six desks.
 *
 * The rule decides the URL of every imported article, so the cases below are the ones
 * that were measured against the real archive rather than imagined: a category that is a
 * desk, one that is not, a post with two desks, and a post with none.
 */

describe('classifyCategory', () => {
  it('keeps a desk a desk', () => {
    for (const desk of DESK_SLUGS) expect(classifyCategory(desk)).toBe('desk');
  });

  it('demotes everything else to a tag', () => {
    // 32.781 posts carry `noticias`. It is not a section here, and it is not discarded.
    for (const slug of ['noticias', 'netflix', 'robert-de-niro', 'uncategorized', 'trailers']) {
      expect(classifyCategory(slug)).toBe('tag');
    }
  });

  it('promotes a category the operator mapped', () => {
    const overrides = new Map([['noticias', 'filmes']]);
    expect(classifyCategory('noticias', overrides)).toBe('desk');
    expect(deskOf('noticias', overrides)).toBe('filmes');
  });
});

describe('deskFor', () => {
  it('is null when nothing matches, rather than picking something', () => {
    // The caller has to report this: an article with no desk is dropped from every
    // listing and from the sitemap, so importing it anyway is invisible loss.
    expect(deskFor(['noticias', 'trailers'])).toBeNull();
    expect(deskFor([])).toBeNull();
  });

  it('finds the desk wherever it sits among the categories', () => {
    // WordPress orders categories by term id, so the desk is usually *not* first.
    expect(deskFor(['noticias', 'filmes'])).toBe('filmes');
    expect(deskFor(['filmes'])).toBe('filmes');
  });

  it('has a written-down answer for every desk', () => {
    // The two lists live in different files and can drift: add a desk to `site.ts` and
    // the precedence would silently fall back to whatever order a Set happened to have,
    // which is the kind of rule nobody can check by reading it.
    expect([...DESK_PRECEDENCE].sort()).toEqual([...DESK_SLUGS].sort());
  });

  it('prefers the more specific desk when a post carries two', () => {
    // A review of a film is a review: the portal renders it with its own template.
    expect(deskFor(['filmes', 'reviews'])).toBe('reviews');
    expect(deskFor(['series', 'quadrinhos'])).toBe('quadrinhos');
    // And the answer does not depend on the order they arrive in.
    expect(deskFor(['reviews', 'filmes'])).toBe('reviews');
  });
});

describe('loadCategoryMap', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'mn-catmap-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is empty when there is no file, because the default policy stands alone', async () => {
    expect((await loadCategoryMap(path.join(dir, 'nao-existe.json'))).size).toBe(0);
  });

  it('reads a mapping', async () => {
    const file = path.join(dir, 'ok.json');
    await writeFile(file, JSON.stringify({ Notícias: 'filmes' }), 'utf8');
    const map = await loadCategoryMap(file);
    // Keys are slugified, so the operator can paste the category name as it reads.
    expect(map.get('noticias')).toBe('filmes');
  });

  it('refuses a destination that is not a desk', async () => {
    const file = path.join(dir, 'bad.json');
    await writeFile(file, JSON.stringify({ noticias: 'jornalismo' }), 'utf8');
    // Accepting it would file articles under a route that does not exist, and they would
    // 404 on their own canonical URL.
    await expect(loadCategoryMap(file)).rejects.toThrow(/not a desk/);
  });

  it('refuses a file that is not an object of strings', async () => {
    const file = path.join(dir, 'array.json');
    await writeFile(file, JSON.stringify(['filmes']), 'utf8');
    await expect(loadCategoryMap(file)).rejects.toThrow(/must be an object/);
  });
});
