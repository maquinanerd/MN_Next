import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  escapeJsonLd,
  isValidSlug,
  readingMinutes,
  safeHref,
  safeSlugParam,
  sanitizeHtml,
  slugify,
  toPlainText,
} from '@mn/content';

describe('slugify', () => {
  it('strips accents and lowercases, as the archive requires', () => {
    expect(slugify('Separação de Ahsoka: o retorno!')).toBe('separacao-de-ahsoka-o-retorno');
  });

  it('drops curly quotes rather than turning them into hyphens', () => {
    expect(slugify('O “melhor” box')).toBe('o-melhor-box');
  });

  it('never leaves a leading or trailing hyphen', () => {
    expect(slugify('  --- Star Wars ---  ')).toBe('star-wars');
  });
});

describe('safeSlugParam', () => {
  it('accepts a well-formed slug', () => {
    expect(safeSlugParam('resident-evil-2026')).toBe('resident-evil-2026');
  });

  it.each([
    ['../../etc/passwd'],
    ['a//b'],
    ['UPPER_CASE'],
    ['with space'],
    ['-leading'],
    ['trailing-'],
    ['%2e%2e%2fadmin'],
  ])('rejects %s', (value) => {
    expect(safeSlugParam(value)).toBeNull();
  });

  it('rejects an undecodable escape instead of throwing', () => {
    expect(safeSlugParam('%E0%A4%A')).toBeNull();
  });

  it('is case-insensitive on the way in', () => {
    expect(safeSlugParam('Resident-Evil')).toBe('resident-evil');
  });
});

describe('safeHref', () => {
  it('keeps http(s) and site-relative paths', () => {
    expect(safeHref('https://example.com/x')).toBe('https://example.com/x');
    expect(safeHref('/series/algo')).toBe('/series/algo');
    expect(safeHref('#secao')).toBe('#secao');
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
    ['//evil.example/phish'],
    ['file:///etc/passwd'],
  ])('rejects %s', (value) => {
    expect(safeHref(value)).toBeNull();
  });

  it('rejects a scheme split by a control character', () => {
    expect(safeHref('java\nscript:alert(1)')).toBeNull();
    expect(safeHref('java\tscript:alert(1)')).toBeNull();
  });

  it('treats an empty or missing value as unlinkable', () => {
    expect(safeHref('')).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
});

describe('escaping', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('prevents JSON-LD from closing its own script tag', () => {
    const payload = escapeJsonLd(JSON.stringify({ headline: '</script><script>alert(1)</script>' }));
    expect(payload).not.toContain('</script>');
    expect(payload).toContain('\\u003c');
  });
});

describe('sanitizeHtml', () => {
  it('removes script elements and counts them', () => {
    const { html, report } = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(html).not.toContain('script');
    expect(html).toContain('<p>');
    expect(report.droppedTags.script).toBe(1);
  });

  it('drops event handlers while keeping the element', () => {
    const { html, report } = sanitizeHtml('<a href="https://x.test" onclick="steal()">link</a>');
    expect(html).toContain('href="https://x.test/"');
    expect(html).not.toContain('onclick');
    expect(report.droppedAttributes['a@onclick']).toBe(1);
  });

  it('drops an unsafe href but keeps the text', () => {
    const { html, report } = sanitizeHtml('<a href="javascript:alert(1)">clique</a>');
    expect(html).not.toContain('javascript');
    expect(html).toContain('clique');
    expect(report.droppedAttributes['a@href:unsafe']).toBe(1);
  });

  it('removes iframes, which are how legacy embeds arrive', () => {
    const { report } = sanitizeHtml('<iframe src="https://evil.test"></iframe>');
    expect(report.droppedTags.iframe).toBe(1);
  });
});

describe('toPlainText', () => {
  it('produces a single-spaced string for excerpts', () => {
    expect(toPlainText('<p>Um  texto</p><p>com&nbsp;dois</p>')).toBe('Um texto com dois');
  });
});

describe('readingMinutes', () => {
  it('never returns zero', () => {
    expect(readingMinutes(3)).toBe(1);
  });

  it('rounds to the nearest minute at 220 wpm', () => {
    expect(readingMinutes(880)).toBe(4);
  });
});

describe('isValidSlug', () => {
  it('rejects an over-long slug', () => {
    expect(isValidSlug('a'.repeat(301))).toBe(false);
  });
});
