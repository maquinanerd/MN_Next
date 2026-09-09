import type { ContentBlock, EmbedProvider, Image, RichText } from '@mn/content';
import { EMBED_PROVIDERS, safeHref, sanitizeHtml, slugify, toPlainText } from '@mn/content';

/**
 * WordPress HTML to `ContentBlock[]`.
 *
 * The most under-estimated part of a news migration: ten years of editorial HTML does
 * not convert cleanly, and the failure mode that matters is *silent* loss. So every node
 * this converter cannot represent is counted and sampled into a report rather than
 * dropped quietly, and the caller decides whether the loss rate is acceptable.
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

/**
 * How a gallery image is referred to before its Kal El id is known.
 *
 * `[gallery ids="12,34"]` names WordPress media ids, and the importer only learns the
 * corresponding Kal El ids later, while transferring assets. This placeholder is the
 * handshake between the two halves, so it is defined once: when it was written out
 * literally on both sides they drifted, and every gallery image resolved to nothing.
 *
 * A rooted path, not a custom scheme — the sanitiser runs in between and drops any src
 * it cannot recognise as a safe URL.
 */
export function shortcodeAssetRef(wpMediaId: number | string): string {
  return `/wp-media-id/${wpMediaId}`;
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

/**
 * `[name attrs]inner[/name]` or a self-closing `[name attrs]`.
 *
 * The backreference is what keeps a closing tag matched to its own opening tag, so a
 * body containing two different shortcodes does not collapse into one match.
 */
const SHORTCODE_RE = /\[([a-z0-9_-]+)([^\]]*)\](?:([\s\S]*?)\[\/\1\])?/gi;

/**
 * Whether a bracket expression is shortcode *syntax* rather than prose in brackets.
 *
 * Three signals, any of which is enough, and none of which ordinary Portuguese produces:
 * a closing `[/name]`, a name in snake_case or kebab-case, or `key="value"` attributes.
 * Measured against the whole archive, this keeps every interpolation an editor wrote and
 * removes `[powerkit_toc title="Table of Contents"]`.
 */
export function isShortcodeSyntax(name: string, attrs: string, inner: string | undefined): boolean {
  if (inner !== undefined) return true;
  if (/[_-]/.test(name)) return true;
  return /[a-z0-9_-]+\s*=\s*["']/i.test(attrs);
}

export interface TransformOptions {
  postId: string | number;
  /** Maps a legacy media URL to an already-imported Kal El image. */
  resolveImage: (src: string) => Image | null;
  report: TransformReport;
  /**
   * The legacy site's own hostname.
   *
   * Only used to tell two very different failures apart. 45.173 of the archive's 87.771
   * body images are hotlinked from other publishers — `static0.srcdn.com`,
   * `variety.com`, `www.hollywoodreporter.com` — and 28.140 come from the site's own
   * media library. Both used to be counted as `image:unresolved`, which turned a
   * licensing question and a broken-mapping bug into one indistinguishable number.
   */
  siteHost?: string;
}

/**
 * Converts one post body.
 *
 * Order matters: shortcodes are extracted before the HTML is sanitised, because
 * sanitising first would strip the very markers the shortcode handler looks for.
 */
export function htmlToBlocks(rawHtml: string, options: TransformOptions): ContentBlock[] {
  const { postId, report } = options;

  /*
   * WordPress shortcodes.
   *
   * The three with an obvious block equivalent are *rewritten into HTML* here rather
   * than passed through: the block parser downstream only understands tags, so a
   * shortcode left intact would either vanish between two paragraphs or survive as
   * literal `[caption]` text in the body. Both are silent loss, which is the one failure
   * this converter exists to prevent. Everything else is counted and removed.
   */
  const withShortcodes = rawHtml.replace(
    SHORTCODE_RE,
    (full: string, name: string, attrs: string, inner: string | undefined) => {
      const kind = name.toLowerCase();

      // [caption ...]<img …/> Legenda[/caption]
      if (kind === 'caption') {
        const body = inner ?? '';
        const img = /<img\b[^>]*\/?>/i.exec(body)?.[0];
        if (!img) {
          note(report, 'shortcode:caption:no-image', postId, full);
          return '';
        }
        const caption = toPlainText(body.replace(img, '')).trim();
        return `<figure>${img}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
      }

      // [gallery ids="12,34"] — each id becomes an image the resolver looks up.
      //
      // The placeholder is a rooted path rather than a custom scheme: the sanitiser
      // runs between here and the parser and drops any src it cannot recognise as a
      // safe URL, which silently emptied every gallery.
      if (kind === 'gallery') {
        const ids = /ids\s*=\s*["']?([\d,\s]+)["']?/i.exec(attrs)?.[1];
        if (!ids) {
          note(report, 'shortcode:gallery:no-ids', postId, full);
          return '';
        }
        return ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .map((id) => `<img src="${shortcodeAssetRef(id)}" alt="" />`)
          .join('');
      }

      // [embed]https://…[/embed] — a bare URL paragraph, which the parser auto-embeds.
      if (kind === 'embed') {
        const url = toPlainText(inner ?? '').trim();
        if (!/^https?:\/\//i.test(url)) {
          note(report, 'shortcode:embed:no-url', postId, full);
          return '';
        }
        return `<p>${url}</p>`;
      }

      /*
       * Square brackets that are not a shortcode.
       *
       * WordPress expands *registered* shortcodes and prints everything else verbatim,
       * and this site registers almost none — Powerkit, whose `[powerkit_toc]` appears
       * 40 times, is not even in `active_plugins`. So most bracket expressions in the
       * archive are ordinary prose, and deleting them mangles real sentences:
       *
       *   "Eu trocava ideias com [a presidente da Lucasfilm] Kathleen Kennedy"
       *   "eu era sincero ao pensar que era o fim [risos]"
       *   "…Sit Down With [SPOILER]"
       *
       * The first is a standard journalistic interpolation, the second the Portuguese
       * transcription marker for laughter, the third part of a headline. All three used
       * to vanish. They are kept now, and only unambiguous shortcode *syntax* is
       * removed — a name with an underscore or hyphen, `key="value"` attributes, or a
       * matching closing tag.
       */
      if (!isShortcodeSyntax(kind, attrs, inner)) {
        note(report, `bracket-text:${kind}`, postId, full);
        return full;
      }

      note(report, `shortcode:${kind}`, postId, full);
      return '';
    },
  );

  /*
   * Video iframes, before the sanitiser reaches them.
   *
   * The sanitiser drops `<iframe>` unconditionally and it is right to — an iframe from a
   * ten-year archive is third-party code running on our origin. But in classic-editor
   * content a YouTube embed *is* an iframe, and dropping it silently loses the video:
   * 454 of them here. Rewriting the recognised providers into the bare-URL form the
   * paragraph branch already understands keeps the video and still never emits a frame,
   * because `EmbedBlock` renders a facade and only loads the player on a click.
   *
   * An iframe from anywhere else is left exactly where it is, so the sanitiser removes
   * it and counts it. That count is the report line that says what was thrown away.
   */
  const withEmbeds = withShortcodes.replace(
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>(?:[\s\S]*?<\/iframe>)?/gi,
    (full: string, rawSrc: string) => {
      const url = safeHref(rawSrc);
      if (!url || !embedProviderFor(url)) return full;
      return `<p>${url}</p>`;
    },
  );

  const { html, report: sanitiseReport } = sanitizeHtml(withEmbeds);
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
      pushImage(imgAttrs, blocks, options);
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
          /*
           * A Gutenberg embed: `wp:embed` saves the URL as text inside a `<figure>`, and
           * the oEmbed filter turns it into an iframe only at render time. Reading raw
           * `post_content` there is no iframe to find — just a figure with a Twitter or
           * YouTube link in it, which used to be reported as a figure with no image and
           * dropped. 302 of them in this archive.
           */
          const bare = /^https?:\/\/\S+$/.exec(toPlainText(inner).trim());
          const url = bare ? safeHref(bare[0]) : null;
          const provider = url ? embedProviderFor(url) : null;
          if (url && provider) {
            blocks.push({ type: 'embed', provider, url });
            continue;
          }
          note(report, 'figure:no-image', postId, inner);
          continue;
        }
        pushImage(imgMatch[1] ?? '', blocks, options, caption ? toPlainText(caption) : undefined);
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

  // Shortcode *syntax* that reached this point was neither converted nor stripped, and
  // would sit in the body as literal `[name attr="x"]`. Prose in brackets is skipped by
  // the same test used above: reporting `[risos]` here as an unconverted shortcode put
  // 1.700 lines of ordinary Portuguese into the migration report as if they were
  // defects, and buried the handful that are.
  for (const leftover of html.matchAll(/\[([a-z0-9_-]+)([^\]]*)\]/gi)) {
    const name = (leftover[1] ?? '').toLowerCase();
    if (!isShortcodeSyntax(name, leftover[2] ?? '', undefined)) continue;
    note(report, `shortcode:unconverted:${name}`, postId, leftover[0]);
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

/**
 * Why an image could not be placed.
 *
 * A body image the importer cannot resolve is one of two entirely different problems. If
 * it points at the legacy site, the media library should have had it and the mapping is
 * broken — a bug. If it points somewhere else, the article was hotlinking another
 * publisher's file, and whether it can be carried over is a licensing decision, not an
 * engineering one. Naming the host is what lets that decision be made.
 */
function unresolvedKind(src: string, siteHost?: string): string {
  try {
    const host = new URL(src).hostname.toLowerCase();
    if (!siteHost || host === siteHost.toLowerCase()) return 'image:unresolved';
    return `image:external:${host}`;
  } catch {
    // A rooted path or a shortcode placeholder: not a host question.
    return 'image:unresolved';
  }
}

function pushImage(attrs: string, blocks: ContentBlock[], options: TransformOptions, caption?: string): void {
  const { resolveImage, report, postId, siteHost } = options;
  const src = /src\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
  const alt = /alt\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? '';
  if (!src) {
    /*
     * No usable `src`. The tag reaching here has already been sanitised, so a URL the
     * sanitiser refused is indistinguishable at this point from a tag that never had
     * one — the count that separates them is `droppedAttributes['img@src:unsafe']`.
     *
     * In this archive that is essentially all of them: 14.445 images carry a URL with
     * spaces and line breaks inside the host and the path —
     * `https://lumiere-a. akamaihd.\n\nnet/v1/images/image_49e88d01. jpeg. region=…` —
     * damage done by whatever wrote the article. They are not recoverable without the
     * original source, and guessing where the spaces used to be would fabricate URLs.
     * Thirteen tags in the whole archive genuinely have `src=""`.
     */
    note(report, 'image:no-src', postId, attrs);
    return;
  }
  const image = resolveImage(src);
  if (!image) {
    note(report, unresolvedKind(src, siteHost), postId, src);
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
