import type { ReviewData } from '@mn/content';

/**
 * Review verdict.
 *
 * The score is text before it is a bar, and each breakdown row prints its number - a
 * meter alone is unreadable to a screen reader and invisible to anyone who cannot
 * distinguish the fill colour.
 */
export function ProductScore({
  score,
  max = 10,
  breakdown,
}: {
  score: number;
  max?: number;
  breakdown?: { label: string; value: number }[];
}) {
  return (
    <div className="mn-score">
      <p style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="mn-score__value">{score.toFixed(1).replace('.', ',')}</span>
        <span className="mn-score__max">de {max}</span>
      </p>
      {breakdown && breakdown.length > 0 ? (
        <div className="mn-score__breakdown">
          {breakdown.map((row) => (
            <div className="mn-score__row" key={row.label}>
              <span className="mn-score__label">
                <span>{row.label}</span>
                <span>
                  {row.value}/{max}
                </span>
              </span>
              <span className="mn-meter" aria-hidden="true">
                <span className="mn-meter__fill" style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="mn-proscons">
      <div className="mn-proscons--pros">
        <p className="mn-proscons__title">Prós</p>
        <ul className="mn-proscons__list">
          {pros.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="mn-proscons--cons">
        <p className="mn-proscons__title">Contras</p>
        <ul className="mn-proscons__list">
          {cons.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReviewVerdict({ review }: { review: ReviewData }) {
  return (
    <section aria-label="Veredito" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ProductScore score={review.score} {...(review.breakdown ? { breakdown: review.breakdown } : {})} />
      <ProsCons pros={review.pros} cons={review.cons} />
      <p className="mn-body">{review.verdict}</p>
    </section>
  );
}
