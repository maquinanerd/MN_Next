/**
 * Spec sheet.
 *
 * A definition list, not a table: these are label/value pairs, and `<dl>` is what a
 * screen reader announces as such. Long values wrap instead of forcing a scroller.
 */
export function SpecTable({ rows, caption }: { rows: { label: string; value: string }[]; caption?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mn-spectable">
      {caption ? (
        <p className="mn-callout__title" style={{ padding: '10px 14px' }}>
          {caption}
        </p>
      ) : null}
      <dl style={{ margin: 0 }}>
        {rows.map((row) => (
          <div className="mn-spectable__row" key={row.label}>
            <dt className="mn-spectable__label">{row.label}</dt>
            <dd className="mn-spectable__value" style={{ margin: 0 }}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
