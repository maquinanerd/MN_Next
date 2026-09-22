import { describe, expect, it } from 'vitest';

import { legacyUploadNames, sanitizeFilename } from '../../lib/legacy-media';

describe('legacyUploadNames — the names an old upload URL may be stored under', () => {
  it('tries the requested file, then the original a size was cut from', () => {
    expect(legacyUploadNames(['2025', '07', 'the-boys-temporada-5-300x169.jpg'])).toEqual({
      stem: 'the-boys-temporada-5',
      names: [
        'the-boys-temporada-5-300x169.jpg',
        'the-boys-temporada-5.jpg',
        'the-boys-temporada-5-scaled.jpg',
        'the-boys-temporada-5-rotated.jpg',
      ],
    });
  });

  it('reaches the original behind a -scaled or -rotated copy', () => {
    expect(legacyUploadNames(['2026', '03', 'poster-scaled.jpg'])?.names).toContain('poster.jpg');
    expect(legacyUploadNames(['2026', '03', 'poster-rotated-1024x768.png'])?.names).toContain('poster.png');
  });

  it('reads past the .webp a conversion plugin appended', () => {
    expect(legacyUploadNames(['2025', '11', 'gta-6.jpg.webp'])?.names[0]).toBe('gta-6.jpg');
  });

  it('stores names the way the CMS cleaned them', () => {
    expect(legacyUploadNames(['2025', '08', 'cena%20de%20ação.jpg'])?.names[0]).toBe('cena_de_a_o.jpg');
    // Kal El's own rule: anything but word characters, dot, hyphen and space becomes `_`,
    // then whitespace does.
    expect(sanitizeFilename('capa final (1).jpg')).toBe('capa_final__1_.jpg');
  });

  it('is nothing for what is not an image under uploads', () => {
    for (const segments of [
      ['2025', '07', 'contrato.pdf'],
      ['2025', '07', 'script.js'],
      ['plugins', 'x', 'y.jpg'],
      ['2025', '07', 'sub', 'y.jpg'],
      ['2025', '07', 'ab.jpg'],
      ['2025', '07', '%E0%A4%A.jpg'],
    ]) {
      expect(legacyUploadNames(segments), segments.join('/')).toBeNull();
    }
  });
});
