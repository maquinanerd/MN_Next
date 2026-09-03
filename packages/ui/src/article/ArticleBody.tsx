import type { ContentBlock } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { RichText, richTextToPlain } from '../primitives/RichText';
import { AdSlot, AD_SLOTS } from '../ads/AdSlot';
import { BuyBox } from '../commercial/BuyBox';
import { ComparisonTable } from '../commercial/ComparisonTable';
import { SpecTable } from '../commercial/SpecTable';
import { EmbedBlock } from './EmbedBlock';
import { WhereToWatch } from '../cinerie/WhereToWatch';

/**
 * Renders `ContentBlock[]`.
 *
 * Exhaustively switched: an unknown block type is a compile error, not a silent gap. No
 * `dangerouslySetInnerHTML` anywhere in this tree - text arrives as `RichText` and is
 * rendered as elements, which is what makes stored XSS from a ten-year WordPress archive
 * structurally impossible rather than merely filtered.
 */

export interface ArticleBodyProps {
  blocks: ContentBlock[];
  /** Affiliate context: every outbound link in prose is `sponsored nofollow`. */
  sponsored?: boolean;
  /** Suppressed on brand-unsafe articles; decided on the server. */
  showAds?: boolean;
  /** Server-derived GAM targeting for in-article slots. */
  adTargeting?: Record<string, string | string[]>;
  dropcapFirstParagraph?: boolean;
  /**
   * Number the top-level headings, for the ranked-list template.
   *
   * A CSS counter rather than text in the heading: the number is a property of the
   * position, and a heading carrying its own "03" goes wrong the moment an entry moves.
   */
  numbered?: boolean;
}

/**
 * Where in-article ads go.
 *
 * One slot roughly every six paragraphs, at most three, never between the headline and
 * the first paragraph, and never adjacent to a quote or a table (docs/07). Computed from
 * the block list rather than injected by an editor, so the rule is enforced not trusted.
 */
function adPositions(blocks: ContentBlock[]): Set<number> {
  const positions = new Set<number>();
  let paragraphs = 0;
  let placed = 0;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;
    if (block.type === 'paragraph') paragraphs += 1;
    if (paragraphs >= 6 && placed < 3) {
      const next = blocks[i + 1];
      const isSafeBoundary =
        block.type === 'paragraph' &&
        next !== undefined &&
        next.type !== 'quote' &&
        next.type !== 'table' &&
        next.type !== 'specTable';
      // Never before the first paragraph has been read.
      if (isSafeBoundary && i > 2) {
        positions.add(i);
        placed += 1;
        paragraphs = 0;
      }
    }
  }
  return positions;
}

function Block({ block, sponsored }: { block: ContentBlock; sponsored: boolean }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className={block.dropcap ? 'mn-body__dropcap' : undefined}>
          <RichText content={block.content} sponsored={sponsored} />
        </p>
      );
    case 'heading': {
      if (block.level === 2) return <h2 id={block.id}>{block.text}</h2>;
      if (block.level === 3) return <h3 id={block.id}>{block.text}</h3>;
      return <h4 id={block.id}>{block.text}</h4>;
    }
    case 'quote':
      return (
        <blockquote>
          <p>
            <RichText content={block.content} sponsored={sponsored} />
          </p>
          {block.attribution ? <cite>{block.attribution}</cite> : null}
        </blockquote>
      );
    case 'list':
      return block.style === 'number' ? (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText content={item} sponsored={sponsored} />
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText content={item} sponsored={sponsored} />
            </li>
          ))}
        </ul>
      );
    case 'image':
      return (
        <figure>
          <div
            className="mn-figure__frame"
            style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 8 }}
          >
            <MnImage image={block.image} sizes={SIZES.hero} />
          </div>
          {block.image.caption || block.image.credit ? (
            <figcaption className="mn-figure__caption">
              {block.image.caption}{' '}
              {block.image.credit ? <span className="mn-figure__credit">{block.image.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'gallery':
      return (
        <div className="mn-gallery">
          {block.images.map((image, i) => (
            <figure key={i}>
              <MnImage image={image} sizes={SIZES.card} fill={false} />
              {image.caption ? <figcaption className="mn-figure__caption">{image.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="mn-table-wrap">
          <table className="mn-table">
            {block.headers.length > 0 ? (
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <RichText content={cell} sponsored={sponsored} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return (
        <aside className={block.tone === 'warning' ? 'mn-callout mn-callout--warning' : 'mn-callout'}>
          {block.title ? <p className="mn-callout__title">{block.title}</p> : null}
          <p>
            <RichText content={block.content} sponsored={sponsored} />
          </p>
        </aside>
      );
    case 'embed':
      return (
        <EmbedBlock provider={block.provider} url={block.url} {...(block.embedId ? { embedId: block.embedId } : {})} />
      );
    case 'sourceLink':
      return (
        <p className="mn-figure__caption">
          Fonte:{' '}
          <a
            href={block.url}
            rel={sponsored ? 'sponsored nofollow noopener noreferrer' : 'noopener noreferrer'}
            target="_blank"
          >
            {block.label}
          </a>
        </p>
      );
    case 'specTable':
      return <SpecTable rows={block.rows} />;
    case 'comparison':
      return <ComparisonTable items={block.items} />;
    case 'buyBox':
      return <BuyBox offers={block.offers} disclosure={block.disclosure} />;
    case 'ad':
      return <AdSlot id={`ad-body-${block.slot}`} {...AD_SLOTS.inArticle} />;
    case 'whereToWatch':
      return <WhereToWatch titles={block.titles} />;
    default: {
      // Exhaustiveness guard: adding a block type without a renderer fails to compile.
      const _never: never = block;
      return _never;
    }
  }
}

export function ArticleBody({
  blocks,
  sponsored = false,
  showAds = true,
  adTargeting,
  dropcapFirstParagraph = false,
  numbered = false,
}: ArticleBodyProps) {
  const positions = showAds ? adPositions(blocks) : new Set<number>();
  let firstParagraphSeen = false;

  return (
    <div className={numbered ? 'mn-body mn-body--list' : 'mn-body'}>
      {blocks.map((block, index) => {
        let rendered = block;
        if (dropcapFirstParagraph && !firstParagraphSeen && block.type === 'paragraph') {
          firstParagraphSeen = true;
          rendered = { ...block, dropcap: true };
        }
        const key = block.type === 'heading' ? `h-${block.id}` : `b-${index}`;
        return (
          <div key={key} style={{ display: 'contents' }}>
            <Block block={rendered} sponsored={sponsored} />
            {positions.has(index) ? (
              <AdSlot
                id={`ad-in-article-${index}`}
                {...AD_SLOTS.inArticle}
                {...(adTargeting ? { targeting: adTargeting } : {})}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Table of contents for longform and dossier chapters. */
export function headingsOf(blocks: ContentBlock[]): { id: string; text: string; level: 2 | 3 | 4 }[] {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: 'heading' }> => b.type === 'heading')
    .map((b) => ({ id: b.id, text: b.text, level: b.level }));
}

/** Word count, used by the reading-time derivation and the import report. */
export function bodyWordCount(blocks: ContentBlock[]): number {
  return blocks.reduce((acc, block) => {
    if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'callout') {
      return acc + richTextToPlain(block.content).split(/\s+/).filter(Boolean).length;
    }
    if (block.type === 'heading') return acc + block.text.split(/\s+/).filter(Boolean).length;
    if (block.type === 'list') {
      return acc + block.items.reduce((a, i) => a + richTextToPlain(i).split(/\s+/).filter(Boolean).length, 0);
    }
    return acc;
  }, 0);
}
