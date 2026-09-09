/**
 * A port of WordPress's `wpautop()`.
 *
 * **Why this has to exist.** The REST API returns `content.rendered` — the post after
 * `the_content` has run — so an importer reading over HTTP never sees raw content. An
 * importer reading a database archive sees nothing else. In this archive 18.786 of the
 * 41.318 published posts (45%) are classic-editor content: paragraphs separated by bare
 * newlines, with no `<p>` anywhere. The block parser in `transform.ts` matches block
 * tags and ignores everything between them, so without this function those posts import
 * as their figures and nothing else — every sentence silently gone, in a form that reads
 * as success because the article exists and has a cover.
 *
 * It is a port, not an interpretation: the sequence of substitutions below is the one in
 * `wp-includes/formatting.php`, in the same order, because the order is what makes it
 * idempotent on content that already has markup. Rewriting it "more cleanly" is how you
 * get `<p>` inside `<ul>`.
 *
 * Deliberately not ported: `wptexturize` (curly quotes and dashes — cosmetic, and an
 * approximation would corrupt code samples), `convert_smilies`, and the srcset/lazy
 * rewriting in `wp_filter_content_tags`, which only adds attributes the sanitiser drops.
 */

const ALL_BLOCKS =
  '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)';

/**
 * Hides the contents of tags whose whitespace is significant, so the paragraph and
 * `<br />` passes cannot reach inside them, and gives back a function that puts them
 * back.
 *
 * `label` is not decoration. Two shields are live at once — one for `<pre>` around the
 * whole function, one for `<script>`/`<style>` around the `<br />` pass — and with a
 * shared placeholder the inner restore matched the outer's marker, found nothing under
 * that index in *its* array, and replaced the entire `<pre>` block with an empty string.
 */
function shield(text: string, pattern: RegExp, label: string): { text: string; restore: (s: string) => string } {
  const kept: string[] = [];
  const masked = text.replace(pattern, (match) => {
    kept.push(match);
    return `<WPShield-${label}:${kept.length - 1}>`;
  });
  const marker = new RegExp(`<WPShield-${label}:(\\d+)>`, 'g');
  return { text: masked, restore: (s: string) => s.replace(marker, (_, i: string) => kept[Number(i)] ?? '') };
}

export function wpautop(input: string, br = true): string {
  if (input.trim() === '') return '';

  // `<pre>` is exempt entirely: its newlines are its content.
  // `\b` matters: without it `<prefix>` opens a `<pre>` shield that swallows everything
  // up to the next `</pre>` in the document.
  const pre = shield(input, /<pre\b[\s\S]*?<\/pre>/gi, 'pre');
  let text = `${pre.text}\n`;

  text = text.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n');
  // Space block tags out so the paragraph split below can see them.
  text = text.replace(new RegExp(`(<${ALL_BLOCKS}[\\s/>])`, 'gi'), '\n\n$1');
  text = text.replace(new RegExp(`(</${ALL_BLOCKS}>)`, 'gi'), '$1\n\n');
  text = text.replace(/\r\n|\r/g, '\n');

  text = text.replace(/\n\n+/g, '\n\n');

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p !== '');
  text = paragraphs.map((p) => `<p>${p.replace(/^\n+|\n+$/g, '')}</p>\n`).join('');

  text = text.replace(/<p>\s*<\/p>/g, '');
  text = text.replace(/<p>([^<]+)<\/(div|address|form)>/g, '<p>$1</p></$2>');
  // A block tag alone in a paragraph is not a paragraph.
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'gi'), '$1');
  text = text.replace(/<p>(<li[\s\S]+?)<\/p>/g, '$1');
  text = text.replace(/<p><blockquote([^>]*)>/gi, '<blockquote$1><p>');
  text = text.replace(/<\/blockquote><\/p>/g, '</p></blockquote>');
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)`, 'gi'), '$1');
  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'gi'), '$1');

  if (br) {
    // Newlines inside these are structural, not editorial.
    const inline = shield(text, /<(script|style|svg|math)\b[\s\S]*?<\/\1>/gi, 'inline');
    text = inline.text.replace(/(?<!<br \/>)\s*\n/g, '<br />\n');
    text = inline.restore(text);
  }

  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*<br />`, 'gi'), '$1');
  text = text.replace(/<br \/>(\s*<\/?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)/g, '$1');
  text = text.replace(/\n<\/p>$/g, '</p>');

  return pre.restore(text);
}

/**
 * Removes Gutenberg block delimiters and reports what they were.
 *
 * `do_blocks()` runs before `wpautop()` in `the_content`, and for the static core blocks
 * this archive uses it does one thing that matters here: it drops the HTML comments that
 * mark block boundaries, leaving the saved markup. Leaving them in would feed
 * `<!-- wp:paragraph -->` to the paragraph wrapper as if it were prose.
 *
 * The names are counted rather than discarded because a block type nobody expected is
 * exactly what the migration report needs to name.
 */
export function stripBlockComments(html: string, seen?: Map<string, number>): string {
  return html.replace(/<!--\s*(\/?)wp:([a-z0-9/-]+)[\s\S]*?-->/gi, (_match, closing: string, name: string) => {
    // Opening delimiters only. Counting both halves reports twice as many blocks as the
    // archive has, which is the sort of number that gets quoted in a migration report
    // and then does not match anything anybody can count by hand.
    if (seen && closing !== '/') {
      const key = String(name).toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return '';
  });
}

/**
 * Raw `post_content` as `the_content` would have delivered it.
 *
 * The two steps in the order WordPress runs them. Shortcodes are deliberately left
 * alone: `transform.ts` expands the ones it can represent and reports the rest, and
 * expanding them here would hide that report.
 */
export function renderPostContent(raw: string, blockCounts?: Map<string, number>): string {
  return wpautop(stripBlockComments(raw, blockCounts));
}
