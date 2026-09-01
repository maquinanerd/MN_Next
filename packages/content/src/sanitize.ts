/**
 * Server-side sanitisation, allowlist first.
 *
 * The charter forbids injecting raw CMS or WordPress HTML. Two layers exist:
 *
 *  1. Structured text never becomes HTML at all - `RichText` is rendered as React
 *     elements by `<RichText />`, so a mark can only produce the tags this module
 *     approves. That is the path all Kal El content takes.
 *  2. `sanitizeHtml` is the narrow escape hatch used by the WordPress importer while it
 *     converts legacy markup into blocks. Its output is parsed into `RichText`, never
 *     handed to `dangerouslySetInnerHTML`.
 *
 * URL policy is shared by both: only `http(s)` and site-relative paths survive, which
 * is what closes `javascript:`, `data:` and protocol-relative redirect tricks.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Returns a safe href, or null when the value must not be linked.
 *
 * Site-relative paths are allowed but `//evil.example` is not: a protocol-relative URL
 * looks internal and is not.
 */
export function safeHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === '') return null;
  // Control characters slip a scheme past a prefix check when split across a newline.
  if ([...value].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return null;
  if (value.startsWith('//')) return null;
  if (value.startsWith('/')) return value;
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True when the href points at this site and should render without `rel=external`. */
export function isInternalHref(href: string, siteUrl: string): boolean {
  if (href.startsWith('/') || href.startsWith('#')) return true;
  try {
    return new URL(href).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] as string);
}

/**
 * JSON-LD is emitted inside a `<script>`; `</script>` and the HTML-comment openers must
 * not survive, or the payload closes its own tag and becomes markup.
 */
export function escapeJsonLd(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

const VOID_TAGS = new Set(['br', 'hr', 'img']);
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'code',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h2',
  'h3',
  'h4',
  'figure',
  'figcaption',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'width', 'height']),
};

export interface SanitizeReport {
  droppedTags: Record<string, number>;
  droppedAttributes: Record<string, number>;
}

/**
 * Minimal allowlist sanitiser used by the importer.
 *
 * Not a general-purpose HTML cleaner and not applied to anything a reader's browser
 * renders directly: legacy WordPress markup goes through here on its way to becoming
 * typed blocks, and every rejection is counted so the import report can show what a
 * ten-year archive actually contains.
 */
export function sanitizeHtml(input: string): { html: string; report: SanitizeReport } {
  const report: SanitizeReport = { droppedTags: {}, droppedAttributes: {} };
  const withoutDangerous = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, (m) => {
      const tag = /<(\w+)/.exec(m)?.[1]?.toLowerCase() ?? 'unknown';
      report.droppedTags[tag] = (report.droppedTags[tag] ?? 0) + 1;
      return '';
    })
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[^>]*\/?>/gi, (m) => {
      const tag = /<(\w+)/.exec(m)?.[1]?.toLowerCase() ?? 'unknown';
      report.droppedTags[tag] = (report.droppedTags[tag] ?? 0) + 1;
      return '';
    });

  const html = withoutDangerous.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (match, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        report.droppedTags[tag] = (report.droppedTags[tag] ?? 0) + 1;
        return '';
      }
      if (match.startsWith('</')) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
      const kept: string[] = [];
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const name = (m[1] as string).toLowerCase();
        const value = m[3] ?? m[4] ?? m[5] ?? '';
        if (!allowed.has(name)) {
          const key = `${tag}@${name}`;
          report.droppedAttributes[key] = (report.droppedAttributes[key] ?? 0) + 1;
          continue;
        }
        if (name === 'href' || name === 'src') {
          const safe = safeHref(value);
          if (!safe) {
            const key = `${tag}@${name}:unsafe`;
            report.droppedAttributes[key] = (report.droppedAttributes[key] ?? 0) + 1;
            continue;
          }
          kept.push(`${name}="${escapeHtml(safe)}"`);
          continue;
        }
        kept.push(`${name}="${escapeHtml(value)}"`);
      }
      const suffix = VOID_TAGS.has(tag) ? ' /' : '';
      return `<${tag}${kept.length ? ` ${kept.join(' ')}` : ''}${suffix}>`;
    },
  );

  return { html, report };
}

/** Strips every tag; used for excerpts, meta descriptions and reading-time counting. */
export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
