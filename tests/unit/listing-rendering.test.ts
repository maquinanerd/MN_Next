import { describe, expect, it } from 'vitest';

import * as editoriaPage from '../../app/[categoria]/page/[n]/page';
import * as feedPage from '../../app/page/[n]/page';

/**
 * The paginated listings are cached like the pages they continue. Without
 * `generateStaticParams` a dynamic segment is rendered on every request whatever `revalidate`
 * says — until 2026-11-27 both answered `private, no-store` in production — and nothing else
 * would notice the function going missing: the pages render the same either way.
 */
describe('paginated listings render once and are cached', () => {
  it.each([
    ['/page/{n}', feedPage],
    ['/{editoria}/page/{n}', editoriaPage],
  ])('%s: nothing at build time, then on-demand ISR at 120 s', (_route, mod) => {
    expect(mod.revalidate).toBe(120);
    expect(typeof mod.generateStaticParams).toBe('function');
    expect(mod.generateStaticParams()).toEqual([]);
    expect('dynamic' in mod).toBe(false);
  });
});
