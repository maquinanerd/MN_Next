import { describe, expect, it } from 'vitest';

import type { ContentBlock } from '@mn/content';

import {
  blocksToKalElNodes,
  emptyIndexes,
  splitText,
  termName,
  termNeedsRepair,
  termSlug,
} from '../../scripts/wp/import';
import { KALEL_LIMITS } from '../../scripts/wp/target';

/**
 * What the first production session lost to Kal El's validation, and must not lose again.
 *
 * 17 tags whose names were lists of titles past 80 characters, and three posts whose only
 * paragraph was one text node of 11.800 to 15.000 characters. Each was a 400 for the whole
 * record — and a failed pass, which kept the session from its idempotency proof.
 */

/** Tag wp 1614, as the archive has it. */
const LONG_TAG =
  'Múltiplos títulos de filmes (incluindo Jaws, Blade Runner: The Final Cut, Alien: Romulus, American Psycho, Kill Bill)';

describe('term names Kal El takes', () => {
  it('decodes what WordPress stored escaped', () => {
    expect(termName('Deadpool &amp; Wolverine', KALEL_LIMITS.tag.name)).toBe('Deadpool & Wolverine');
  });

  it('cuts a name past the limit at a word, and marks the cut', () => {
    const name = termName(LONG_TAG, KALEL_LIMITS.tag.name);
    expect(name.length).toBeLessThanOrEqual(KALEL_LIMITS.tag.name);
    expect(name.endsWith('…')).toBe(true);
    expect(LONG_TAG.startsWith(name.slice(0, -1))).toBe(true);
    // A word boundary — "Alien:" does not fit whole — and no dangling comma before the mark.
    expect(name).toBe('Múltiplos títulos de filmes (incluindo Jaws, Blade Runner: The Final Cut…');
  });

  it('decodes before measuring: the entity is not the name', () => {
    // 80 characters once decoded, 84 as stored.
    const stored = `${'a'.repeat(38)} &amp; ${'b'.repeat(39)}`;
    expect(termName(stored, 80)).toBe(`${'a'.repeat(38)} & ${'b'.repeat(39)}`);
  });

  it('fits a slug at a hyphen, and leaves one under the limit alone', () => {
    const slug = termSlug(LONG_TAG, KALEL_LIMITS.tag.slug);
    expect(slug.length).toBeLessThanOrEqual(KALEL_LIMITS.tag.slug);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slug).toBe(
      'multiplos-titulos-de-filmes-incluindo-jaws-blade-runner-the-final-cut-alien-romulus-american-psycho',
    );
    expect(termSlug('deadpool-wolverine', KALEL_LIMITS.tag.slug)).toBe('deadpool-wolverine');
  });
});

describe('repairing what the first run wrote', () => {
  it('renames a tag still under the escaped name the import gave it', () => {
    expect(termNeedsRepair('Lilo &amp; Stitch', 'Lilo &amp; Stitch', 'Lilo & Stitch')).toBe(true);
  });

  it('leaves a name the newsroom changed, and one already right', () => {
    expect(termNeedsRepair('Lilo e Stitch', 'Lilo &amp; Stitch', 'Lilo & Stitch')).toBe(false);
    expect(termNeedsRepair('Marvel', 'Marvel', 'Marvel')).toBe(false);
  });
});

describe('text nodes Kal El takes', () => {
  // The shape of wp 113552: one paragraph, 15.018 characters, sentences and spaces.
  const sentence = 'O mercado de cinema no Sudeste Asiático acaba de ganhar um novo motor de tração. ';
  const giant = sentence.repeat(Math.ceil(15_018 / sentence.length)).slice(0, 15_018);

  it('splits at a space, under the limit, losing nothing', () => {
    const parts = splitText(giant);
    expect(parts.length).toBe(2);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(KALEL_LIMITS.text);
    expect(parts.join('')).toBe(giant);
    expect(parts[0]?.endsWith(' ')).toBe(true);
  });

  it('cuts where it must when there is no space, never inside a surrogate pair', () => {
    const emoji = '😀'.repeat(12); // 24 UTF-16 units
    const parts = splitText(emoji, 5);
    expect(parts.join('')).toBe(emoji);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(5);
      expect(/^(?:[\uD800-\uDBFF][\uDC00-\uDFFF])*$/.test(part)).toBe(true);
    }
  });

  it('leaves a short text as the one node it was', () => {
    expect(splitText('Curto.')).toEqual(['Curto.']);
  });

  it('sends the giant paragraph as one paragraph of text nodes within the limit', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', content: [{ type: 'text', text: giant, marks: [{ type: 'bold' }] }] },
      { type: 'heading', level: 2, text: giant },
    ] as ContentBlock[];
    const [paragraph, heading] = blocksToKalElNodes(blocks, emptyIndexes()) as {
      type: string;
      content: { type: string; text: string; marks: { type: string }[] }[];
    }[];
    for (const node of [paragraph, heading]) {
      expect(node?.content.length).toBe(2);
      for (const text of node?.content ?? []) expect(text.text.length).toBeLessThanOrEqual(KALEL_LIMITS.text);
      expect(node?.content.map((t) => t.text).join('')).toBe(giant);
    }
    // The marks travel with every piece: a bold paragraph stays bold throughout.
    expect(paragraph?.content.every((t) => t.marks[0]?.type === 'bold')).toBe(true);
  });

  it('cuts an image field past its limit instead of refusing the article', () => {
    const indexes = emptyIndexes();
    const mediaId = '0d000000-0001-4000-9000-000000000001';
    const blocks = [
      {
        type: 'image',
        image: { url: `/media/${mediaId}`, width: 1200, height: 675, alt: 'a'.repeat(600), caption: 'c'.repeat(2100) },
      },
    ] as ContentBlock[];
    const [image] = blocksToKalElNodes(blocks, indexes) as { attrs: Record<string, string> }[];
    expect(image?.attrs['mediaId']).toBe(mediaId);
    expect(image?.attrs['altText']?.length).toBe(KALEL_LIMITS.altText);
    expect(image?.attrs['caption']?.length).toBe(KALEL_LIMITS.caption);
  });
});
