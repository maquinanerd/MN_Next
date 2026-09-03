import type { ContentBlock } from '@mn/content';

import { headingsOf } from './ArticleBody';

/**
 * "Nesta lista" — the numbered index the list template carries in its sidebar.
 *
 * A ranked list is the one article shape where a reader arrives wanting to know what the
 * five things *are* before reading any of them. The design gives it its own panel, and
 * the standard "Mais lidas" rail takes that slot instead, which turns the defining
 * feature of the template into a plain run of headings.
 *
 * Built from the same headings the body renders, so it cannot list an entry the article
 * does not have.
 *
 * **The convention:** in a list article every `h2` *is* an entry. There is no "list item"
 * node in the CMS — the document model has headings and nothing narrower — so an editorial
 * subheading inside a ranked list would be numbered here and in the body. The index and
 * the numerals read the same set, so they can never disagree with each other; what they
 * cannot do is disagree with an intention the document has no way to express. Recorded in
 * DECISIONS.md alongside the other reserved conventions.
 */
export function ListIndex({ blocks, title = 'Nesta lista' }: { blocks: ContentBlock[]; title?: string }) {
  const entries = headingsOf(blocks).filter((h) => h.level === 2);
  if (entries.length < 2) return null;

  return (
    <nav className="mn-listindex" aria-label={title}>
      <p className="mn-listindex__head">{title}</p>
      <ol className="mn-listindex__items">
        {entries.map((entry, index) => (
          <li className="mn-listindex__item" key={entry.id}>
            <span className="mn-listindex__num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
