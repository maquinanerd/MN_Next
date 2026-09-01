import type { ComparisonItem } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { formatBRL } from './BuyBox';

/**
 * Ranked comparison, rendered as an ordered list rather than a table.
 *
 * The ranking *is* the semantics, and an `<ol>` announces "item 2 of 10" where a table
 * announces a grid position. It also reflows on a phone without a horizontal scroller.
 * The same array feeds the page's `ItemList` JSON-LD.
 */
export function ComparisonTable({ items }: { items: ComparisonItem[] }) {
  return (
    <ol className="mn-comparison" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li className="mn-comparison__item" key={`${item.rank}-${item.name}`}>
          <span className="mn-comparison__rank" aria-hidden="true">
            {item.rank}
          </span>
          <div>
            {item.highlight ? <p className="mn-comparison__highlight">{item.highlight}</p> : null}
            <p className="mn-comparison__name">
              <span className="mn-visually-hidden">{item.rank}º lugar: </span>
              {item.name}
            </p>
            {item.specs && item.specs.length > 0 ? (
              <p className="mn-state__text">{item.specs.map((spec) => `${spec.label}: ${spec.value}`).join(' · ')}</p>
            ) : null}
            {item.score !== undefined ? (
              <p className="mn-state__text">Nota {item.score.toFixed(1).replace('.', ',')} de 10</p>
            ) : null}
          </div>
          {item.offer ? (
            <a className="mn-cta" href={item.offer.url} rel="sponsored nofollow noopener noreferrer" target="_blank">
              {formatBRL(item.offer.price)}
              <span className="mn-visually-hidden"> na {item.offer.retailer}</span>
            </a>
          ) : item.image ? (
            <span
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                display: 'block',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <MnImage image={item.image} alt="" sizes={SIZES.thumb} />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
