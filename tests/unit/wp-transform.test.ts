import { describe, expect, it } from 'vitest';

import type { Image } from '@mn/content';
import { emptyReport, embedProviderFor, htmlToBlocks, inlineFromHtml } from '../../scripts/wp/transform';
import { detectImageType } from '../../scripts/wp/source';
import { Counter, parseArgs } from '../../scripts/wp/cli';
import { idempotencyKey, mappingKey } from '../../scripts/wp/state';

/**
 * The WordPress body parser.
 *
 * The migration plan calls this the most under-estimated part of the project, and the
 * failure that matters is *silent* loss: markup that quietly disappears looks like a
 * clean import. So every case here checks both halves — what survives, and that what
 * does not survive is counted.
 */

const IMAGE: Image = { url: '/media/abc', width: 1600, height: 900, alt: 'da fixture' };
const resolveImage = (src: string): Image | null => (src.includes('conhecida') ? IMAGE : null);

function convert(html: string) {
  const report = emptyReport();
  const blocks = htmlToBlocks(html, { postId: 1, resolveImage, report });
  return { blocks, report };
}

describe('inlineFromHtml', () => {
  it('keeps bold, italic and links as marks', () => {
    const content = inlineFromHtml('um <strong>negrito</strong> e um <a href="https://x.test">link</a>');
    const marks = content.flatMap((n) => (n.type === 'text' ? n.marks.map((m) => m.type) : []));
    expect(marks).toContain('bold');
    expect(marks).toContain('link');
  });

  it('drops an unsafe href but keeps the words', () => {
    const content = inlineFromHtml('<a href="javascript:alert(1)">clique</a>');
    const text = content.map((n) => (n.type === 'text' ? n.text : '')).join('');
    expect(text).toBe('clique');
    expect(JSON.stringify(content)).not.toContain('javascript');
  });

  it('turns <br> into a break rather than dropping the line', () => {
    const content = inlineFromHtml('uma<br>duas');
    expect(content.some((n) => n.type === 'break')).toBe(true);
  });

  it('decodes the entities a ten-year archive is full of', () => {
    const content = inlineFromHtml('caf&#233;s &amp; ch&aacute;s&hellip;');
    const text = content.map((n) => (n.type === 'text' ? n.text : '')).join('');
    expect(text).toContain('&');
    expect(text).toContain('…');
  });

  it('never returns an empty array, which would produce an empty node', () => {
    expect(inlineFromHtml('').length).toBeGreaterThan(0);
  });
});

describe('htmlToBlocks', () => {
  it('converts the ordinary shapes', () => {
    const { blocks } = convert(
      '<p>Primeiro.</p><h2>Um subtítulo</h2><ul><li>a</li><li>b</li></ul><blockquote><p>citado</p><cite>Fonte</cite></blockquote>',
    );
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'list', 'quote']);
    const quote = blocks.find((b) => b.type === 'quote');
    if (quote?.type !== 'quote') throw new Error('expected a quote');
    expect(quote.attribution).toBe('Fonte');
  });

  it('gives every heading a stable anchor', () => {
    const { blocks } = convert('<h2>Ordem de exibição</h2>');
    const heading = blocks.find((b) => b.type === 'heading');
    if (heading?.type !== 'heading') throw new Error('expected a heading');
    expect(heading.id).toBe('ordem-de-exibicao');
    expect(heading.level).toBe(2);
  });

  it('resolves a known image and reports one that is missing', () => {
    const { blocks, report } = convert(
      '<figure><img src="https://old.test/conhecida.jpg" alt="uma legenda"><figcaption>Legenda</figcaption></figure>' +
        '<img src="https://old.test/ausente.jpg" alt="x">',
    );
    const images = blocks.filter((b) => b.type === 'image');
    expect(images).toHaveLength(1);
    if (images[0]?.type !== 'image') throw new Error('expected an image');
    expect(images[0].image.caption).toBe('Legenda');
    expect(report.unknown['image:unresolved']).toBe(1);
  });

  it('counts an image without alt text for the editorial pass', () => {
    const { report } = convert('<img src="https://old.test/conhecida.jpg" alt="">');
    expect(report.imagesMissingAlt).toBe(1);
  });

  it('reads a bare URL paragraph as the auto-embed WordPress meant it to be', () => {
    const { blocks } = convert('<p>https://www.youtube.com/watch?v=abc123</p>');
    const embed = blocks.find((b) => b.type === 'embed');
    if (embed?.type !== 'embed') throw new Error('expected an embed');
    expect(embed.provider).toBe('youtube');
  });

  it('reports an auto-embed from a host it does not know instead of dropping it', () => {
    const { blocks, report } = convert('<p>https://algum-site-desconhecido.test/widget</p>');
    expect(blocks.filter((b) => b.type === 'embed')).toHaveLength(0);
    expect(report.unknown['auto-embed:unknown']).toBe(1);
  });

  it('reads a two-column table as a spec sheet', () => {
    const { blocks } = convert(
      '<table><tr><td>Páginas</td><td>2.000</td></tr><tr><td>Editora</td><td>Panini</td></tr></table>',
    );
    const spec = blocks.find((b) => b.type === 'specTable');
    if (spec?.type !== 'specTable') throw new Error('expected a specTable');
    expect(spec.rows).toEqual([
      { label: 'Páginas', value: '2.000' },
      { label: 'Editora', value: 'Panini' },
    ]);
  });

  it('keeps a wider table as a table', () => {
    const { blocks } = convert('<table><tr><td>a</td><td>b</td><td>c</td></tr></table>');
    expect(blocks.find((b) => b.type === 'table')).toBeDefined();
  });

  it('counts an unknown shortcode rather than leaving its text in the body', () => {
    const { blocks, report } = convert('<p>antes</p>[algum_shortcode id="4"]<p>depois</p>');
    expect(JSON.stringify(blocks)).not.toContain('algum_shortcode');
    expect(report.unknown['shortcode:algum_shortcode']).toBe(1);
  });

  it('strips a script and counts it', () => {
    const { blocks, report } = convert('<p>ok</p><script>alert(1)</script>');
    expect(JSON.stringify(blocks)).not.toContain('alert');
    expect(report.droppedTags.script).toBe(1);
  });

  it('removes an iframe, which is how legacy embeds arrive', () => {
    const { report } = convert('<p>a</p><iframe src="https://evil.test"></iframe>');
    expect(report.droppedTags.iframe).toBe(1);
  });

  it('never publishes an empty article when the body had no block wrapper', () => {
    const { blocks, report } = convert('texto solto sem tag nenhuma');
    expect(blocks).toHaveLength(1);
    expect(report.unknown['body:unwrapped']).toBe(1);
  });

  it('drops a paragraph that is only whitespace', () => {
    const { blocks } = convert('<p>   </p><p>real</p>');
    expect(blocks).toHaveLength(1);
  });

  it('keeps at most 20 samples so a large archive does not produce a huge report', () => {
    const html = Array.from({ length: 40 }, (_, i) => `[sc_${i}]`).join('');
    const { report } = convert(html);
    expect(report.samples.length).toBeLessThanOrEqual(20);
    expect(Object.keys(report.unknown).length).toBe(40);
  });
});

describe('embedProviderFor', () => {
  it.each([
    ['https://www.youtube.com/watch?v=x', 'youtube'],
    ['https://youtu.be/x', 'youtube'],
    ['https://x.com/a/status/1', 'x'],
    ['https://twitter.com/a/status/1', 'x'],
    ['https://vimeo.com/123', 'vimeo'],
  ])('recognises %s', (url, expected) => {
    expect(embedProviderFor(url)).toBe(expected);
  });

  it('returns null for an unknown host and for junk', () => {
    expect(embedProviderFor('https://algum.test/a')).toBeNull();
    expect(embedProviderFor('not a url')).toBeNull();
  });
});

describe('detectImageType', () => {
  it('recognises a JPEG by its bytes, not by its name', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
  });

  it('recognises PNG, GIF and WEBP', () => {
    expect(detectImageType(Buffer.from('89504e470d0a1a0a0000000000', 'hex'))).toBe('image/png');
    expect(detectImageType(Buffer.from('GIF89a......', 'latin1'))).toBe('image/gif');
    expect(detectImageType(Buffer.from('RIFF____WEBP', 'latin1'))).toBe('image/webp');
  });

  it('rejects an executable renamed to .jpg', () => {
    expect(detectImageType(Buffer.from('MZ\0\0\0\0\0\0\0', 'latin1'))).toBeNull();
  });

  it('rejects SVG, which is active content rather than an image', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">', 'latin1'))).toBeNull();
  });
});

describe('cli', () => {
  const specs = [
    { name: 'apply', description: '', type: 'boolean' as const, default: false },
    { name: 'limit', description: '', type: 'number' as const, default: 0 },
    { name: 'state', description: '', type: 'string' as const, default: 'x.json' },
  ];

  it('defaults to a dry run', () => {
    expect(parseArgs([], specs).values.apply).toBe(false);
  });

  it('parses flags in both --k v and --k=v form', () => {
    expect(parseArgs(['--apply', '--limit', '50'], specs).values).toMatchObject({ apply: true, limit: 50 });
    expect(parseArgs(['--limit=25'], specs).values.limit).toBe(25);
  });

  it('refuses an unknown flag rather than ignoring it', () => {
    expect(() => parseArgs(['--typo'], specs)).toThrow();
  });

  it('refuses a value-taking flag with no value', () => {
    expect(() => parseArgs(['--limit'], specs)).toThrow();
  });
});

describe('idempotence keys', () => {
  it('is stable for the same source entity', () => {
    expect(idempotencyKey('post', 1234)).toBe(idempotencyKey('post', 1234));
  });

  it('differs between entities and between kinds', () => {
    expect(idempotencyKey('post', 1234)).not.toBe(idempotencyKey('post', 1235));
    expect(idempotencyKey('post', 1234)).not.toBe(idempotencyKey('media', 1234));
  });

  it('produces a key Kal El will accept', () => {
    const key = idempotencyKey('post', 'algo com espaço/e-barra');
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(key.length).toBeLessThanOrEqual(128);
  });

  it('names the mapping slot per source entity', () => {
    expect(mappingKey('post', 7)).toBe('wpPost:7');
    expect(mappingKey('media', 7)).toBe('wpMedia:7');
  });
});

describe('Counter', () => {
  it('starts declared keys at zero so a report never has holes', () => {
    const c = new Counter(['read', 'failed']);
    expect(c.toJSON()).toEqual({ read: 0, failed: 0 });
  });

  it('counts and reports', () => {
    const c = new Counter();
    c.inc('a');
    c.inc('a', 4);
    expect(c.get('a')).toBe(5);
    expect(c.get('never-touched')).toBe(0);
  });
});
