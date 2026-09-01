import type { CommercialKind } from '@mn/content';

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

export function SponsoredLabel({ kind, brand }: { kind: CommercialKind; brand?: string }) {
  return (
    <p className="mn-sponsored">
      <span className="mn-sponsored__badge">{LABEL[kind]}</span>
      {brand ? <span>Em parceria com {brand}</span> : null}
    </p>
  );
}
