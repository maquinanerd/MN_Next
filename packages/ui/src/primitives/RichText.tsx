import { Fragment, type ReactNode } from 'react';
import type { InlineMark, RichText as RichTextValue } from '@mn/content';

/**
 * Renders structured inline content as React elements.
 *
 * There is no HTML string anywhere in this path, so a mark can only ever produce one of
 * the six tags below and a link can only carry an href the mapper already validated.
 * This is why the charter's "never inject raw CMS HTML" rule is structurally satisfied
 * rather than merely intended.
 */

const MARK_ORDER: InlineMark['type'][] = ['link', 'code', 'strike', 'underline', 'italic', 'bold'];

function wrap(node: ReactNode, mark: InlineMark, key: string): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{node}</strong>;
    case 'italic':
      return <em key={key}>{node}</em>;
    case 'underline':
      return <u key={key}>{node}</u>;
    case 'strike':
      return <s key={key}>{node}</s>;
    case 'code':
      return <code key={key}>{node}</code>;
    case 'link': {
      if (!mark.href) return <Fragment key={key}>{node}</Fragment>;
      const external = /^https?:\/\//i.test(mark.href);
      return (
        <a
          key={key}
          href={mark.href}
          {...(mark.title ? { title: mark.title } : {})}
          {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {node}
        </a>
      );
    }
    default:
      return <Fragment key={key}>{node}</Fragment>;
  }
}

export interface RichTextProps {
  content: RichTextValue;
  /** Affiliate context: every outbound link is marked `sponsored nofollow`. */
  sponsored?: boolean;
}

export function RichText({ content, sponsored = false }: RichTextProps) {
  return (
    <>
      {content.map((node, index) => {
        if (node.type === 'break') return <br key={`br-${index}`} />;
        let out: ReactNode = node.text;
        const marks = [...node.marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
        for (const [markIndex, mark] of marks.entries()) {
          if (mark.type === 'link' && sponsored && mark.href && /^https?:\/\//i.test(mark.href)) {
            out = (
              <a
                key={`m-${index}-${markIndex}`}
                href={mark.href}
                rel="sponsored nofollow noopener noreferrer"
                target="_blank"
              >
                {out}
              </a>
            );
            continue;
          }
          out = wrap(out, mark, `m-${index}-${markIndex}`);
        }
        return <Fragment key={`n-${index}`}>{out}</Fragment>;
      })}
    </>
  );
}

/** Flattens rich text to a plain string, for `alt`, `title` and meta descriptions. */
export function richTextToPlain(content: RichTextValue): string {
  return content
    .map((n) => (n.type === 'text' ? n.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
