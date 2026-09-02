import { describe, expect, it } from 'vitest';

import {
  kalelArticleSchema,
  kalelArticleSummarySchema,
  kalelAuthorSchema,
  kalelCategorySchema,
  kalelEntitySchema,
  kalelMediaSchema,
  kalelRedirectSchema,
  kalelTagSchema,
} from '../../packages/content/src/kalel/dto';
import { all } from '../fake-kalel/corpus';

/**
 * The stand-in CMS has to be held to the contract, or it proves nothing.
 *
 * `tests/fake-kalel/` exists so the delivery path can be exercised with
 * `CONTENT_SOURCE=kalel` and no credentials. The risk in any such double is that it
 * drifts toward whatever makes the application pass — at which point a green suite means
 * only that the fake agrees with the code, not that either agrees with Kal El.
 *
 * Two things prevent that. The server validates each response before sending it, and
 * this file validates the whole corpus up front so a shape error fails here, by name,
 * instead of surfacing as a 500 in the middle of a page render. It caught two on the
 * first run: authors were missing `email` and `userId`, and entities used `kind` and
 * `metadata` where the CMS has `type`, `description` and `externalRefs`.
 *
 * The shapes are transcribed from `packages/contracts/src/{editorial,media,seo}.ts` in
 * the Kal El repository, which is read but never vendored into this one.
 */

const COLLECTIONS = [
  ['categories', all.categories, kalelCategorySchema],
  ['tags', all.tags, kalelTagSchema],
  ['authors', all.authors, kalelAuthorSchema],
  ['entities', all.entities, kalelEntitySchema],
  ['media', all.media, kalelMediaSchema],
  ['articles', all.articles, kalelArticleSchema],
  ['redirects', all.redirects, kalelRedirectSchema],
] as const;

describe('the stand-in CMS speaks the real contract', () => {
  it.each(COLLECTIONS)('every %s row parses', (name, rows, schema) => {
    for (const row of rows) {
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        throw new Error(`${name} row ${String((row as { id: string }).id)}: ${JSON.stringify(parsed.error.issues)}`);
      }
    }
    expect(rows.length).toBeGreaterThan(0);
  });

  it('the draft parses too, since preview is the only thing that reads it', () => {
    expect(kalelArticleSchema.safeParse(all.draftArticle).success).toBe(true);
    expect(all.draftArticle['status']).toBe('draft');
    expect(all.draftArticle['publishedAt']).toBeNull();
  });

  it('a listing row parses as a summary, without the document', () => {
    // The list endpoint omits `document`, `seo` and `provenance`. If the application's
    // summary schema quietly required one of them, every listing would fail against the
    // real CMS while passing against a fake that sent the full row.
    const first = all.articles[0];
    expect(first).toBeDefined();
    const { document: _d, seo: _s, provenance: _p, workflowNote: _w, ...summary } = first as Record<string, unknown>;
    expect(kalelArticleSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('holds enough content to exercise paging on both models', () => {
    // Articles page by cursor at 100 max; media pages by offset at 200 max. The corpus
    // has to be big enough that a listing needs more than one call at the sizes the
    // repository actually asks for.
    expect(all.articles.length).toBeGreaterThanOrEqual(40);
    expect(all.media.length).toBeGreaterThanOrEqual(24);
    expect(new Set(all.articles.map((a) => a['slug'])).size).toBe(all.articles.length);
  });

  it('spreads articles across every desk the site publishes', () => {
    const byCategory = new Set(all.articles.flatMap((a) => a['categories'] as string[]));
    expect(byCategory.size).toBe(all.categories.length);
  });
});
