import { describe, expect, it } from 'vitest';

import { renderPostContent, stripBlockComments, wpautop } from '../../scripts/wp/wpautop';
import { emptyReport, htmlToBlocks } from '../../scripts/wp/transform';

/**
 * The step that decides whether 45% of the archive survives.
 *
 * `transform.ts` matches block tags. Classic-editor content has none — it is prose with
 * blank lines — so an archive importer that skips `wpautop` produces articles containing
 * their images and not one word of their text, and reports every one of them as a
 * success. These cases are the WordPress behaviours that outcome depends on.
 */

describe('wpautop', () => {
  it('wraps blank-line-separated prose in paragraphs', () => {
    expect(wpautop('Primeiro.\n\nSegundo.')).toBe('<p>Primeiro.</p>\n<p>Segundo.</p>\n');
  });

  it('turns a single newline into a line break, not a paragraph', () => {
    expect(wpautop('Uma linha\noutra linha')).toContain('<br />');
    expect(wpautop('Uma linha\noutra linha').match(/<p>/g)).toHaveLength(1);
  });

  it('leaves existing block markup alone instead of nesting paragraphs in it', () => {
    const out = wpautop('<h2>Título</h2>\n\nTexto.');
    expect(out).toContain('<h2>Título</h2>');
    expect(out).not.toContain('<p><h2>');
  });

  it('does not wrap list items in paragraphs', () => {
    const out = wpautop('<ul>\n<li>Um</li>\n<li>Dois</li>\n</ul>');
    expect(out).not.toContain('<p><li>');
    expect(out).not.toContain('<li><p>');
  });

  it('keeps a figure usable, stray </p> and all', () => {
    const out = wpautop('<figure><img src="/a.jpg" /><figcaption>Legenda</figcaption></figure>\n\nTexto.');
    // WordPress leaves an unbalanced `</p>` here — `img` is not a block tag, so the
    // opening `<p>` is stripped and its closer is not. Reproducing the quirk is the
    // point of a port; the figure still opens and closes around its parts, which is
    // what the block parser reads, and the sanitiser drops the orphan.
    expect(out).toContain('<figure><img src="/a.jpg" />');
    expect(out).toContain('<figcaption>Legenda</figcaption>');
    expect(out).toContain('</figure>');
    expect(out).toContain('<p>Texto.</p>');
  });

  it('and that figure still becomes an image block with its caption', () => {
    const html = wpautop('<figure><img src="/a.jpg" alt="Arte" /><figcaption>Legenda</figcaption></figure>');
    const blocks = htmlToBlocks(html, {
      postId: 3,
      report: emptyReport(),
      resolveImage: (src) => ({ url: src, width: 1200, height: 675, alt: 'Arte' }),
    });
    const image = blocks.find((b) => b.type === 'image');
    expect(image).toBeDefined();
    expect(JSON.stringify(image)).toContain('Legenda');
  });

  it('leaves the inside of a pre exactly as it was', () => {
    const out = wpautop('<pre>linha 1\nlinha 2</pre>\n\nDepois.');
    expect(out).toContain('<pre>linha 1\nlinha 2</pre>');
    expect(out).not.toContain('linha 1<br />');
  });

  it('is a no-op on content that is already paragraphs', () => {
    const once = wpautop('<p>Um.</p>\n<p>Dois.</p>');
    expect(wpautop(once)).toBe(once);
  });

  it('is empty for empty input rather than an empty paragraph', () => {
    expect(wpautop('   \n  ')).toBe('');
  });

  it('collapses a double <br /> into a paragraph break, as the editor intended', () => {
    const out = wpautop('Um<br /><br />Dois');
    expect(out.match(/<p>/g)).toHaveLength(2);
  });
});

describe('stripBlockComments', () => {
  it('removes the delimiters and keeps the markup between them', () => {
    const seen = new Map<string, number>();
    const out = stripBlockComments('<!-- wp:paragraph -->\n<p>Oi</p>\n<!-- /wp:paragraph -->', seen);
    expect(out.trim()).toBe('<p>Oi</p>');
    // One block, counted once — the opening delimiter. Counting the closer too reported
    // 375.042 paragraphs in an archive that has 187.521 of them.
    expect(seen.get('paragraph')).toBe(1);
  });

  it('removes a self-closing block with attributes', () => {
    const out = stripBlockComments('<!-- wp:image {"id":42,"sizeSlug":"large"} -->\n<figure></figure>');
    expect(out).not.toContain('wp:image');
    expect(out).toContain('<figure>');
  });
});

describe('renderPostContent, end to end into blocks', () => {
  it('a classic post keeps its prose', () => {
    // Shaped like the real thing: bold marker, a figure from an external host, prose.
    const raw =
      'James Gunn provoca os fãs.\n\n' +
      '<figure><img src="https://cdn.example.com/a.jpg" alt="Superman" /></figure>\n\n' +
      'O encontro pode já ter acontecido.';
    const blocks = htmlToBlocks(renderPostContent(raw), { postId: 1, report: emptyReport(), resolveImage: () => null });
    const paragraphs = blocks.filter((b) => b.type === 'paragraph');
    expect(paragraphs).toHaveLength(2);
    // The failure this whole file exists for: without wpautop this array is empty.
    expect(JSON.stringify(paragraphs)).toContain('James Gunn');
    expect(JSON.stringify(paragraphs)).toContain('já ter acontecido');
  });

  it('a Gutenberg post is unchanged by the round trip', () => {
    const raw = '<!-- wp:paragraph -->\n<p>Texto do bloco.</p>\n<!-- /wp:paragraph -->';
    const blocks = htmlToBlocks(renderPostContent(raw), { postId: 2, report: emptyReport(), resolveImage: () => null });
    expect(blocks).toHaveLength(1);
    expect(JSON.stringify(blocks)).toContain('Texto do bloco.');
  });
});
