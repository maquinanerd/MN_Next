import { describe, expect, it } from 'vitest';

import { currentSection } from '../../packages/ui/src/lib/section';

describe('currentSection (the footer marks the reader’s section)', () => {
  it('reads the home and its "mais notícias" pages as Notícias', () => {
    expect(currentSection('/')).toBe('/');
    expect(currentSection('/page/3')).toBe('/');
  });

  it('reads an editoria, its pages and its articles as that editoria', () => {
    for (const path of ['/cinema', '/cinema/page/2', '/cinema/o-misterio-de-scarlett-johansson']) {
      expect(currentSection(path)).toBe('/cinema');
    }
  });

  it('ignores a query string or a fragment', () => {
    expect(currentSection('/games?page=2')).toBe('/games');
    expect(currentSection('/games#conteudo')).toBe('/games');
  });
});
