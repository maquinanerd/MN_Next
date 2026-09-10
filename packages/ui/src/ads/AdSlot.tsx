import { AD_FORMATS, type AdFormato } from '@mn/tokens';

import { cx } from '../lib/cx';

/**
 * Reserved advertising space (kit docs/05).
 *
 * The box keeps its dimensions whether or not an ad ever fills it, so the page never
 * shifts and never shortens: `--mn-surface`, a 1px border, the size written in the
 * middle, and "Publicidade" in 10px above it, left-aligned. `max-width: 100%` with
 * border-box sizing means no slot can cause horizontal scrolling on a phone.
 *
 * `ordem` makes the accessible name unique when a page carries the same format twice
 * ("Anúncio 1, 728 por 90"), which is what the prototypes do and what axe requires.
 *
 * When an ad server is wired up, it renders into `[data-ad-slot]`; nothing else changes.
 */
export function AdSlot({
  formato,
  ordem,
  sticky = false,
  className,
}: {
  formato: AdFormato;
  ordem?: number;
  /** 300×600 beside a scrolling list: `position: sticky; top: 24px`. */
  sticky?: boolean;
  className?: string;
}) {
  const { width, height } = AD_FORMATS[formato];
  // Leaderboards stretch to the column up to their width; rectangles are fixed-width.
  const fluid = formato === '728x90' || formato === '970x250';
  const label = `Anúncio ${ordem !== undefined ? `${ordem}, ` : ''}${width} por ${height}`;

  return (
    <div className={cx('flex flex-col items-center gap-6', sticky && 'sticky top-24 self-start', className)}>
      <span className="self-start text-10 leading-none text-muted">Publicidade</span>
      <div
        role="group"
        aria-label={label}
        data-ad-slot={formato}
        className={cx(
          'box-border flex max-w-full items-center justify-center border border-line bg-surface text-11 text-muted',
          fluid ? 'w-full' : '',
        )}
        style={fluid ? { maxWidth: width, height } : { width, height }}
      >
        <span aria-hidden="true">
          {width} × {height}
        </span>
      </div>
    </div>
  );
}
