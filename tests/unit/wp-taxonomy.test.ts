import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DESK_SLUGS } from '@mn/content';

import {
  DESK_PRECEDENCE,
  WP_DESK_ALIASES,
  classifyCategory,
  deskFor,
  deskOf,
  loadCategoryMap,
} from '../../scripts/wp/taxonomy';

/**
 * 8.619 WordPress categories onto seven editorias.
 *
 * The rule decides the URL of every imported article, so the cases below are the ones
 * that were measured against the real archive rather than imagined: a category that is a
 * desk, one that was renamed, one that is not a desk, a post with two desks, and one with
 * none.
 */

describe('classifyCategory', () => {
  it('keeps an editoria an editoria', () => {
    for (const desk of DESK_SLUGS) expect(classifyCategory(desk)).toBe('desk');
  });

  it('carries the archive desks the new front end renamed', () => {
    // 41.020 posts are filed under the old six. Without the aliases every one would land
    // with no editoria — and so with no public URL.
    expect(deskOf('filmes')).toBe('cinema');
    expect(deskOf('series')).toBe('series-e-tv');
    expect(deskOf('reviews')).toBe('especiais');
    for (const target of Object.values(WP_DESK_ALIASES)) expect(DESK_SLUGS).toContain(target);
  });

  it('demotes everything else to a tag', () => {
    // 32.781 posts carry `noticias`. It is not a section here, and it is not discarded.
    for (const slug of ['noticias', 'netflix', 'robert-de-niro', 'uncategorized', 'trailers']) {
      expect(classifyCategory(slug)).toBe('tag');
    }
  });

  it('promotes a category the operator mapped, and the map wins over an alias', () => {
    const overrides = new Map([
      ['noticias', 'cinema'],
      ['reviews', 'games'],
    ]);
    expect(classifyCategory('noticias', overrides)).toBe('desk');
    expect(deskOf('noticias', overrides)).toBe('cinema');
    expect(deskOf('reviews', overrides)).toBe('games');
  });
});

describe('deskFor', () => {
  it('is null when nothing matches, rather than picking something', () => {
    // An article with no desk is dropped from every listing and from the sitemap, so
    // importing it anyway is invisible loss; the caller reports it instead.
    expect(deskFor(['noticias', 'trailers'])).toBeNull();
    expect(deskFor([])).toBeNull();
  });

  it('finds the desk wherever it sits among the categories', () => {
    // WordPress orders categories by term id, so the desk is usually *not* first.
    expect(deskFor(['noticias', 'filmes'])).toBe('cinema');
    expect(deskFor(['cinema'])).toBe('cinema');
  });

  it('has a written-down answer for every editoria', () => {
    // The two lists live in different files and can drift.
    expect([...DESK_PRECEDENCE].sort()).toEqual([...DESK_SLUGS].sort());
  });

  it('prefers the more specific desk when a post carries two', () => {
    // A review of a film is a review first.
    expect(deskFor(['filmes', 'reviews'])).toBe('especiais');
    expect(deskFor(['series', 'quadrinhos'])).toBe('quadrinhos');
    // And the answer does not depend on the order they arrive in.
    expect(deskFor(['reviews', 'filmes'])).toBe('especiais');
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
    await writeFile(file, JSON.stringify({ Notícias: 'cinema' }), 'utf8');
    const map = await loadCategoryMap(file);
    // Keys are slugified, so the operator can paste the category name as it reads.
    expect(map.get('noticias')).toBe('cinema');
  });

  it('refuses a destination that is not an editoria — including an old desk slug', async () => {
    const file = path.join(dir, 'bad.json');
    await writeFile(file, JSON.stringify({ noticias: 'filmes' }), 'utf8');
    // `filmes` is no longer a route: accepting it would file articles under a URL that
    // 404s on their own canonical address.
    await expect(loadCategoryMap(file)).rejects.toThrow(/not a desk/);
  });

  it('refuses a file that is not an object of strings', async () => {
    const file = path.join(dir, 'array.json');
    await writeFile(file, JSON.stringify(['cinema']), 'utf8');
    await expect(loadCategoryMap(file)).rejects.toThrow(/must be an object/);
  });
});
