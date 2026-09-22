import { describe, expect, it } from 'vitest';

import { originalOf, uploadKeys } from '../../lib/legacy-media';
import { parseMediaTable } from '../../lib/legacy-media-table';

describe('uploadKeys — the table keys an old upload URL may have', () => {
  it('tries the path as asked, then the original a size was cut from, month folder kept', () => {
    expect(uploadKeys(['2025', '07', 'the-boys-temporada-5-300x169.jpg'])).toEqual([
      '2025/07/the-boys-temporada-5-300x169.jpg',
      '2025/07/the-boys-temporada-5.jpg',
    ]);
  });

  it('reaches the original behind a -scaled or -rotated copy', () => {
    expect(uploadKeys(['2026', '03', 'poster-scaled.jpg'])).toEqual([
      '2026/03/poster-scaled.jpg',
      '2026/03/poster.jpg',
    ]);
    expect(uploadKeys(['2026', '03', 'poster-rotated-1024x768.png'])).toContain('2026/03/poster.png');
  });

  it('reads past the .webp a conversion plugin appended', () => {
    expect(uploadKeys(['2025', '11', 'gta-6.jpg.webp'])?.[0]).toBe('2025/11/gta-6.jpg');
  });

  it('keeps a name as Next decoded it, accents included', () => {
    expect(uploadKeys(['2025', '08', 'cena de ação.jpg'])).toEqual(['2025/08/cena de ação.jpg']);
  });

  it('is nothing for what is not an image under uploads', () => {
    for (const segments of [
      ['2025', '07', 'contrato.pdf'],
      ['2025', '07', 'script.js'],
      ['plugins', 'x', 'y.jpg'],
      ['2025', '07', 'sub', 'y.jpg'],
      ['25', '07', 'y.jpg'],
      ['2025', '07', 'a\\b.jpg'],
    ]) {
      expect(uploadKeys(segments), segments.join('/')).toBeNull();
    }
  });
});

describe('originalOf', () => {
  it('drops the -scaled or -rotated WordPress added, and nothing else', () => {
    expect(originalOf('2025/07/foto-scaled.jpg')).toBe('2025/07/foto.jpg');
    expect(originalOf('2025/07/foto-rotated.png')).toBe('2025/07/foto.png');
    expect(originalOf('2025/07/foto.jpg')).toBe('2025/07/foto.jpg');
    expect(originalOf('2025/07/rescaled-art.jpg')).toBe('2025/07/rescaled-art.jpg');
  });
});

describe('parseMediaTable', () => {
  it('reads path-tab-id lines, keeps names with spaces, and skips anything that is not an id', () => {
    const table = parseMediaTable(
      [
        '2025/07/capa.jpg\t0000000d-0003-4000-8000-000000000003',
        '2025/08/cena de ação.jpg\t0000000d-0004-4000-8000-000000000004',
        '2025/09/ruim.jpg\tnao-e-um-id',
        'sem-tab',
        '',
      ].join('\n'),
    );
    expect([...table.entries()]).toEqual([
      ['2025/07/capa.jpg', '0000000d-0003-4000-8000-000000000003'],
      ['2025/08/cena de ação.jpg', '0000000d-0004-4000-8000-000000000004'],
    ]);
  });
});
