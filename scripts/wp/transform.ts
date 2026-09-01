import type { ContentBlock, EmbedProvider, Image, RichText } from '@mn/content';
import { EMBED_PROVIDERS, safeHref, sanitizeHtml, slugify, toPlainText } from '@mn/content';

/**
 * WordPress HTML to `ContentBlock[]`.
 *
 * The most under-estimated part of a news migration: ten years of editorial HTML does
 * not convert cleanly, and the failure mode that matters is *silent* loss. So every node
 * this converter cannot represent is counted and sampled into a report rather than
 * dropped quietly, and the caller decides whether the残 rate is acceptable.
 *
 * No DOM library: the parser is a small, deliberately boring tokenizer over an
 * already-sanitised string. It only has to understand the block-level shapes WordPress
 * actually emits, and anything it does not understand becomes a counted unknown.
 */

export interface TransformReport {
  /** Node types the converter could not represent, with counts. */
  unknown: Record<string, number>;
  /** Up to 20 samples, so an editor can see what the numbers mean. */
  samples: { postId: string | number; kind: string; excerpt: string }[];
  droppedTags: Record<string, number>;
  droppedAttributes: Record<string, number>;
  /** Images that arrived without alt text; these need an editorial pass. */
  imagesMissingAlt: number;
}

export function emptyReport(): TransformReport {
  return { unknown: {}, samples: [], droppedTags: {}, droppedAttributes: {}, imagesMissingAlt: 0 };
}

function note(report: TransformReport, kind: string, postId: string | number, excerpt: string): void {
  report.unknown[kind] = (report.unknown[kind] ?? 0) + 1;
  if (report.samples.length < 20) {
    report.samples.push({ postId, kind, excerpt: excerpt.slice(0, 240) });
  }
}

/** Inline HTML to `RichText`, preserving the marks the domain model supports. */
export function inlineFromHtml(html: string): RichText {
  const out: RichText = [];
  const stack: { tag: string; href?: string }[] = [];
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  const marksFromStack = () =>
    stack
      .map((frame) => {
        switch (frame.tag) {
          case 'strong':
          case 'b':
            return { type: 'bold' as const };
          case 'em':
          case 'i':
            return { type: 'italic' as const };
          case 'u':
            return { type: 'underline' as const };
          case 's':
            return { type: 'strike' as const };
          case 'code':
            return { type: 'code' as const };
          case 'a':
            return frame.href ? { type: 'link' as const, href: frame.href } : null;
          default:
            return null;
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

  while ((match = tokenRe.exec(html)) !== null) {
    const [full, tag, attrs, text] = match;
    if (text !== undefined) {
      const decoded = decodeEntities(text);
      if (decoded.trim() === '' && out.length === 0) continue;
      out.push({ type: 'text', text: decoded, marks: marksFromStack() });
      continue;
    }
    const name = (tag ?? '').toLowerCase();
    if (name === 'br') {
      out.push({ type: 'break' });
      continue;
    }
    if (full?.startsWith('</')) {
      const index = stack.map((f) => f.tag).lastIndexOf(name);
      if (index >= 0) stack.splice(index, 1);
      continue;
    }
    if (name === 'a') {
      const href = safeHref(/href\s*=\s*"([^"]*)"/.exec(attrs ?? '')?.[1] ?? null);
      stack.push(href ? { tag: 'a', href } : { tag: 'a' });
      continue;
    }
    stack.push({ tag: name });
  }

  return out.length > 0 ? out : [{ type: 'text', text: '', marks: [] }];
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#8217;': '’',
  '&#8220;': '“',
  '&#8221;': '”',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

export function decodeEntities(text: string): string {
  return text.replace(/&[#a-zA-Z0-9]+;/g, (entity) => ENTITIES[entity] ?? entity);
}

/** Recognised oEmbed hosts. Anything else is reported, never rendered. */
export function embedProviderFor(url: string): EmbedProvider | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
    if (host.endsWith('instagram.com')) return 'instagram';
    if (host.endsWith('tiktok.com')) return 'tiktok';
    if (host.endsWith('vimeo.com')) return 'vimeo';
    if (host.endsWith('spotify.com')) return 'spotify';
  } catch {
    return null;
  }
  return null;
}

export interface TransformOptions {
  postId: string | number;
  /** Maps a legacy media URL to an already-imported Kal El image. */
  resolveImage: (src: string) => Image | null;
  report: TransformReport;
}

/**
 * Converts one post body.
 *
 * Order matters: shortcodes are extracted before the HTML is sanitised, because
 * sanitising first would strip the very markers the shortcode handler looks for.
 */
export function htmlToBlocks(rawHtml: string, options: TransformOptions): ContentBlock[] {
  const { postId, resolveImage, report } = options;

  // WordPress shortcodes: convert the ones with an obvious block equivalent, count the rest.
  const withShortcodes = rawHtml.replace(/\[([a-z_-]+)([^\]]*)\](?:([\s\S]*?)\[\/\1\])?/gi, (full, name: string) => {
    const kind = name.toLowerCase();
    if (kind === 'caption' || kind === 'gallery' || kind === 'embed') return full;
    note(report, `shortcode:${kind}`, postId, full);
    return '';
  });

  const { html, report: sanitiseReport } = sanitizeHtml(withShortcodes);
  for (const [tag, count] of Object.entries(sanitiseReport.droppedTags)) {
    report.droppedTags[tag] = (report.droppedTags[tag] ?? 0) + count;
  }
  for (const [attr, count] of Object.entries(sanitiseReport.droppedAttributes)) {
    report.droppedAttributes[attr] = (report.droppedAttributes[attr] ?? 0) + count;
  }

  const blocks: ContentBlock[] = [];
  const blockRe = /<(p|h2|h3|h4|ul|ol|blockquote|figure|table)\b[^>]*>([\s\S]*?)<\/\1>|<img\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  let headingIndex = 0;

  while ((match = blockRe.exec(html)) !== null) {
    const tag = (match[1] ?? '').toLowerCase();
    const inner = match[2] ?? '';
    const imgAttrs = match[3];

    if (imgAttrs !== undefined) {
      pushImage(imgAttrs, blocks, resolveImage, report, postId);
      continue;
    }

    switch (tag) {
      case 'p': {
        const plain = toPlainText(inner).trim();
        if (plain === '') continue;
        // A paragraph that is nothing but a bare URL is a WordPress auto-embed.
        const bare = /^https?:\/\/\S+$/.exec(plain);
        if (bare) {
          const url = safeHref(plain);
          const provider = url ? embedProviderFor(url) : null;
          if (url && provider) blocks.push({ type: 'embed', provider, url });
          else note(report, 'auto-embed:unknown', postId, plain);
          continue;
        }
        blocks.push({ type: 'paragraph', content: inlineFromHtml(inner) });
        continue;
      }
      case 'h2':
      case 'h3':
      case 'h4': {
        const text = toPlainText(inner).trim();
        if (text === '') continue;
        const level = tag === 'h2' ? 2 : tag === 'h3' ? 3 : 4;
        const base = slugify(text);
        blocks.push({ type: 'heading', level, text, id: base || `secao-${headingIndex + 1}` });
        headingIndex += 1;
        continue;
      }
      case 'ul':
      case 'ol': {
        const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => inlineFromHtml(m[1] ?? ''));
        if (items.length === 0) continue;
        blocks.push({ type: 'list', style: tag === 'ol' ? 'number' : 'bullet', items });
        continue;
      }
      case 'blockquote': {
        const attribution = /<cite\b[^>]*>([\s\S]*?)<\/cite>/i.exec(inner)?.[1];
        const body = inner.replace(/<cite\b[^>]*>[\s\S]*?<\/cite>/i, '');
        blocks.push({
          type: 'quote',
          content: inlineFromHtml(body),
          ...(attribution ? { attribution: toPlainText(attribution).trim() } : {}),
        });
        continue;
      }
      case 'figure': {
        const imgMatch = /<img\b([^>]*)\/?>/i.exec(inner);
        const caption = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner)?.[1];
        if (!imgMatch) {
          note(report, 'figure:no-image', postId, inner);
          continue;
        }
        pushImage(imgMatch[1] ?? '', blocks, resolveImage, report, postId, caption ? toPlainText(caption) : undefined);
        continue;
      }
      case 'table': {
        const headers = [...inner.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => toPlainText(m[1] ?? ''));
        const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
          .map((row) =>
            [...(row[1] ?? '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => inlineFromHtml(c[1] ?? '')),
          )
          .filter((row) => row.length > 0);
        if (rows.length === 0) {
          note(report, 'table:empty', postId, inner);
          continue;
        }
        // Two-column tables are almost always spec sheets in this archive.
        if (rows.every((r) => r.length === 2)) {
          blocks.push({
            type: 'specTable',
            rows: rows.map((r) => ({
              label: plain(r[0] as RichText),
              value: plain(r[1] as RichText),
            })),
          });
          continue;
        }
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
      default:
        note(report, `block:${tag}`, postId, inner);
    }
  }

  if (blocks.length === 0 && toPlainText(html).trim() !== '') {
    // The body had text but no recognised block wrapper - keep it as one paragraph
    // rather than publishing an empty article.
    blocks.push({ type: 'paragraph', content: inlineFromHtml(html) });
    note(report, 'body:unwrapped', postId, html);
  }

  return blocks;
}

function plain(content: RichText): string {
  return content
    .map((n) => (n.type === 'text' ? n.text : ' '))
    .join('')
    .trim();
}

function pushImage(
  attrs: string,
  blocks: ContentBlock[],
  resolveImage: (src: string) => Image | null,
  report: TransformReport,
  postId: string | number,
  caption?: string,
): void {
  const src = /src\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
  const alt = /alt\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? '';
  if (!src) {
    note(report, 'image:no-src', postId, attrs);
    return;
  }
  const image = resolveImage(src);
  if (!image) {
    note(report, 'image:unresolved', postId, src);
    return;
  }
  if (alt.trim() === '') report.imagesMissingAlt += 1;
  blocks.push({
    type: 'image',
    image: { ...image, alt: alt || image.alt, ...(caption ? { caption } : {}) },
    size: 'wide',
  });
}

export const RECOGNISED_EMBEDS: readonly EmbedProvider[] = EMBED_PROVIDERS;
