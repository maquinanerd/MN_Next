import { describe, expect, it } from 'vitest';

import { originalOf, uploadKeys } from '../../lib/legacy-media';
import { parseMediaTable } from '../../lib/legacy-media-table';
import { mediaTableFrom } from '../../scripts/wp/build-media-redirects';
import { Counter } from '../../scripts/wp/cli';

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

describe('mediaTableFrom — the table media-redirects:build writes', () => {
  const ID = (n: number): string => `0000000d-000${n}-4000-8000-00000000000${n}`;
  const mappings = { 'wpMedia:1': ID(1), 'wpMedia:2': ID(2), 'wpMedia:3': ID(3), 'wpMedia:9': 'not-a-uuid' };

  it('maps each imported attachment by its exact path, month folder included', () => {
    const table = mediaTableFrom(
      [
        { id: 1, file: '2025/07/image-1.png' },
        { id: 2, file: '2025/08/image-1.png' },
      ],
      mappings,
      new Counter(['attachments', 'mapped', 'notImported', 'originals', 'unsafe']),
    );
    expect(table.get('2025/07/image-1.png')).toBe(ID(1));
    expect(table.get('2025/08/image-1.png')).toBe(ID(2));
  });

  it('gives a -scaled upload its original name too, unless an attachment of its own holds it', () => {
    const counts = new Counter(['attachments', 'mapped', 'notImported', 'originals', 'unsafe']);
    const table = mediaTableFrom(
      [
        { id: 1, file: '2025/07/poster-scaled.jpg' },
        { id: 2, file: '2025/07/capa-scaled.jpg' },
        { id: 3, file: '2025/07/capa.jpg' },
      ],
      mappings,
      counts,
    );
    expect(table.get('2025/07/poster.jpg')).toBe(ID(1));
    expect(table.get('2025/07/capa.jpg')).toBe(ID(3));
    expect(counts.toJSON()).toMatchObject({ mapped: 3, originals: 1 });
  });

  it('leaves out what was not imported, and any path that is not plain', () => {
    const counts = new Counter(['attachments', 'mapped', 'notImported', 'originals', 'unsafe']);
    const table = mediaTableFrom(
      [
        { id: 7, file: '2025/07/sem-mapeamento.jpg' },
        { id: 9, file: '2025/07/id-invalido.jpg' },
        { id: 1, file: '../../etc/passwd' },
        { id: 2, file: '2025/07/com\ttab.jpg' },
        { id: 3, file: '' },
      ],
      mappings,
      counts,
    );
    expect(table.size).toBe(0);
    expect(counts.toJSON()).toMatchObject({ notImported: 2, unsafe: 3 });
  });
});
