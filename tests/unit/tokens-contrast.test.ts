import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EDITORIAS, NOTICIAS } from '../../lib/content/editorias';

/**
 * Contrast, measured from the tokens themselves (kit rule: every text ≥ 4.5:1).
 *
 * The values are read out of `packages/tokens/src/tokens.css`, so changing a colour there
 * without checking it fails here. The pairs are the ones the templates actually render.
 */

const css = readFileSync(path.join(process.cwd(), 'packages/tokens/src/tokens.css'), 'utf8');

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match?.[1]) throw new Error(`token --color-${name} not found`);
  return match[1];
}

/** `var(--color-x)` → the hex behind it. */
function resolve(value: string): string {
  const match = /var\(--color-([a-z0-9-]+)\)/.exec(value);
  return match?.[1] ? token(match[1]) : value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const WHITE = '#ffffff';

describe('text on white', () => {
  it.each([
    ['ink', 'ink'],
    ['body', 'ink-2'],
    ['support', 'ink-3'],
    ['metadata', 'muted'],
    ['excerpt', 'excerpt'],
    ['byline', 'byline'],
    ['notes', 'note'],
    ['red as text', 'mn-red-text'],
  ])('%s passes 4.5:1', (_label, name) => {
    expect(contrast(token(name), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the "Publicidade" label and the size inside the ad box pass on the ad surface', () => {
    expect(contrast(token('muted'), token('surface'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('editoria labels and fills', () => {
  const all = [NOTICIAS, ...Object.values(EDITORIAS)];

  it.each(all.map((e) => [e.nome, e] as const))('%s: its text variant passes on white', (_nome, e) => {
    expect(contrast(resolve(e.corTexto), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(all.map((e) => [e.nome, e] as const))('%s: the label on its fill passes', (_nome, e) => {
    const on = e.textoSobreCor === 'light' ? WHITE : token('ink');
    expect(contrast(resolve(e.corFundoTexto), on)).toBeGreaterThanOrEqual(4.5);
  });

  it('proves the correction was needed: the kit pairing for Cinema fails', () => {
    // docs/01 pairs #A248FC with white. It is 4.31:1 — and ink is 4.38:1.
    expect(contrast(token('ed-cinema'), WHITE)).toBeLessThan(4.5);
    expect(contrast(token('ed-cinema'), token('ink'))).toBeLessThan(4.5);
  });

  it('the store button: white on brand red', () => {
    expect(contrast(token('mn-red'), WHITE)).toBeGreaterThanOrEqual(4.5);
  });
});
