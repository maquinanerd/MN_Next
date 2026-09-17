import { describe, expect, it } from 'vitest';

import { DuplicateFinder, legacyPathOf, normaliseTitle, postFingerprint } from '../../scripts/wp/duplicates';

/**
 * Posts published twice. The archive's three real cases — 9883/9884, 9880/9886 and
 * 11001/11002 — share title and body byte for byte; only the cover upload differs. The
 * rule has to find those, keep the lowest id whatever order the source yields, and never
 * mistake two different stories for copies.
 */

const BODY = '<p>Superman passou dos US$ 500 milhões.</p>';

describe('postFingerprint', () => {
  it('is the same for a title that differs only in markup, spacing and case', () => {
    expect(normaliseTitle('Superman de  James <em>Gunn</em>')).toBe('superman de james gunn');
    expect(postFingerprint({ title: 'Superman de James Gunn', content: BODY })).toBe(
      postFingerprint({ title: '  superman DE james <strong>Gunn</strong> ', content: BODY }),
    );
  });

  it('differs when the body differs by a single character', () => {
    expect(postFingerprint({ title: 'Superman', content: BODY })).not.toBe(
      postFingerprint({ title: 'Superman', content: BODY.replace('500', '501') }),
    );
  });

  it('differs for the same body under another title', () => {
    expect(postFingerprint({ title: 'Superman', content: BODY })).not.toBe(
      postFingerprint({ title: 'Batman', content: BODY }),
    );
  });
});

describe('DuplicateFinder', () => {
  const candidate = (id: number, fingerprint: string, legacyPath = `/post-${id}/`) => ({
    id,
    fingerprint,
    legacyPath,
    finalPath: `/cinema/post-${id}`,
  });

  it('keeps the lowest id even when the copy arrives first', () => {
    const finder = new DuplicateFinder();
    expect(finder.add(candidate(9886, 'a', '/bomba-2/'))).toBe(true);
    expect(finder.add(candidate(9880, 'a', '/bomba/'))).toBe(false);
    expect(finder.pairs()).toEqual([
      {
        skippedId: 9886,
        keptId: 9880,
        legacyPath: '/bomba-2/',
        keptLegacyPath: '/bomba/',
        keptFinalPath: '/cinema/post-9880',
      },
    ]);
  });

  it('pairs every copy of a group with its lowest id, lowest skipped id first, and leaves singles alone', () => {
    const finder = new DuplicateFinder();
    for (const c of [candidate(11002, 'k'), candidate(1, 'x'), candidate(11001, 'k'), candidate(11005, 'k')]) {
      finder.add(c);
    }
    expect(finder.pairs().map((p) => [p.skippedId, p.keptId])).toEqual([
      [11002, 11001],
      [11005, 11001],
    ]);
  });

  it('reads the legacy path of a permalink, and passes through what is not a URL', () => {
    expect(legacyPathOf('https://www.maquinanerd.com.br/superman-de-james-gunn/')).toBe('/superman-de-james-gunn/');
    expect(legacyPathOf('/ja-um-caminho/')).toBe('/ja-um-caminho/');
  });
});
