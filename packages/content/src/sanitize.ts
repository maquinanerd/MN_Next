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
  // Attribution inside a pull quote; without it every migrated quote loses its source.
  'cite',
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

/**
 * The named character references plain text meets: markup's own, typography, and the
 * Portuguese and Spanish letters an editor or a plugin wrote escaped. WordPress stores term
 * names HTML-escaped (`Deadpool &amp; Wolverine`), and excerpts in this archive carry
 * `ser&aacute;`.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  deg: '°',
  ordf: 'ª',
  ordm: 'º',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  iexcl: '¡',
  iquest: '¿',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  atilde: 'ã',
  Atilde: 'Ã',
  auml: 'ä',
  Auml: 'Ä',
  ccedil: 'ç',
  Ccedil: 'Ç',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  ecirc: 'ê',
  Ecirc: 'Ê',
  euml: 'ë',
  Euml: 'Ë',
  iacute: 'í',
  Iacute: 'Í',
  igrave: 'ì',
  Igrave: 'Ì',
  icirc: 'î',
  Icirc: 'Î',
  iuml: 'ï',
  Iuml: 'Ï',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  oacute: 'ó',
  Oacute: 'Ó',
  ograve: 'ò',
  Ograve: 'Ò',
  ocirc: 'ô',
  Ocirc: 'Ô',
  otilde: 'õ',
  Otilde: 'Õ',
  ouml: 'ö',
  Ouml: 'Ö',
  uacute: 'ú',
  Uacute: 'Ú',
  ugrave: 'ù',
  Ugrave: 'Ù',
  ucirc: 'û',
  Ucirc: 'Û',
  uuml: 'ü',
  Uuml: 'Ü',
};

/** A code point text may carry: not a surrogate, not a control character other than whitespace. */
function isTextCodePoint(code: number): boolean {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  if (code < 0x20) return code === 0x09 || code === 0x0a || code === 0x0d;
  return code < 0x7f || code > 0x9f;
}

/**
 * Character references to the characters they name, in one pass.
 *
 * One pass, because decoding is not repeatable: `&amp;lt;` is the text `&lt;`, and the
 * replace-per-entity chain this used to be turned it into `<`. Numeric references are
 * decoded whole (`&#34;`, `&#x201C;`); a reference this table does not know, or one naming
 * no character, is left exactly as written.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi, (whole, ref: string) => {
    if (ref.startsWith('#')) {
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
      return isTextCodePoint(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ref] ?? NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/** Strips every tag and decodes what is left; used for titles, excerpts and names. */
export function toPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|h[1-6]|blockquote|tr)>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}
