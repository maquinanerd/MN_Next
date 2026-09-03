import type { CommercialKind, Image } from '@mn/content';

import { MnImage } from '../primitives/MnImage';

/**
 * Commercial disclosure badge.
 *
 * Mandatory above the headline on every commercial article, always visible, never
 * collapsible, and always text - never an image, so it survives image blocking and is
 * read aloud (docs/07, docs/09).
 */

const LABEL: Record<CommercialKind, string> = {
  'branded-content': 'Publieditorial',
  affiliate: 'Contém link de afiliado',
  'review-sample': 'Produto cedido para análise',
  campaign: 'Campanha publicitária',
};

export function SponsoredLabel({
  kind,
  brand,
  brandLogo,
}: {
  kind: CommercialKind;
  brand?: string;
  brandLogo?: Image;
}) {
  return (
    <p className="mn-sponsored">
      <span className="mn-sponsored__badge">{LABEL[kind]}</span>
      {brand ? <span>Em parceria com {brand}</span> : null}
      {/*
       * "Oferecido por", at the right end of the strip, as the design has it. The field
       * existed on `CommercialMeta` and nothing rendered it — an advertiser's mark is
       * part of the disclosure, not decoration, and leaving it out makes the strip say
       * less than the law expects it to.
       *
       * The badge above still carries the disclosure in text, so an image that fails to
       * load costs nothing.
       */}
      {brandLogo ? (
        <span className="mn-sponsored__by">
          <span className="mn-sponsored__bylabel">Oferecido por</span>
          <span className="mn-sponsored__logo">
            <MnImage image={brandLogo} alt={brand ? `Logo ${brand}` : ''} sizes="120px" fill={false} />
          </span>
        </span>
      ) : null}
    </p>
  );
}
