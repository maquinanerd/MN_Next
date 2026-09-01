import type { Offer } from '@mn/content';

import { DateTime } from '../primitives/misc';

/**
 * Affiliate buy box.
 *
 * Three things are non-negotiable here (docs/07):
 *  - every outbound purchase link carries `rel="sponsored nofollow"`, no exceptions;
 *  - `verifiedAt` is visible next to the price - a price without a date is a complaint;
 *  - the disclosure text is server-rendered and never assembled in the browser.
 */

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export function BuyBox({ offers, disclosure }: { offers: Offer[]; disclosure: string }) {
  if (offers.length === 0) return null;
  const primary = offers[0] as Offer;
  const discount =
    primary.listPrice && primary.listPrice > primary.price
      ? Math.round(((primary.listPrice - primary.price) / primary.listPrice) * 100)
      : null;

  return (
    <aside className="mn-buybox" aria-label="Onde comprar">
      <div className="mn-buybox__head">
        <span>Onde comprar</span>
        <span>{primary.retailer}</span>
      </div>

      {offers.map((offer) => (
        <div className="mn-buybox__offer" key={`${offer.retailer}-${offer.url}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <span className="mn-buybox__price">{formatBRL(offer.price)}</span>
            {offer.listPrice && offer.listPrice > offer.price ? (
              <span className="mn-buybox__list-price">{formatBRL(offer.listPrice)}</span>
            ) : null}
            {discount && offer === primary ? <span className="mn-buybox__discount">-{discount}%</span> : null}
            {offer.coupon ? <span className="mn-buybox__discount">Cupom {offer.coupon}</span> : null}
            {!offer.inStock ? <span className="mn-state__code">Indisponível no momento</span> : null}
          </div>
          <a className="mn-cta" href={offer.url} rel="sponsored nofollow noopener noreferrer" target="_blank">
            Ver oferta na {offer.retailer}
          </a>
        </div>
      ))}

      <p className="mn-disclosure">
        Preço verificado em <DateTime iso={primary.verifiedAt} />. {disclosure}
      </p>
    </aside>
  );
}

/**
 * Promotional ticker.
 *
 * Wraps onto multiple lines by design: the prototype clipped its last item behind
 * `nowrap` + `overflow: hidden` with no animation, which the audit flagged as a
 * permanently invisible offer.
 */
export function OfferTicker({ items }: { items: { label: string; price: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mn-offerticker">
      {items.map((item) => (
        <span className="mn-offerticker__item" key={item.label}>
          {item.label} <span className="mn-offerticker__price">{formatBRL(item.price)}</span>
        </span>
      ))}
    </div>
  );
}
