import { AD_FORMATS, type AdFormato } from '@mn/tokens';

import { cx } from '../lib/cx';
import { AdPush } from './AdPush';
import { adsenseClient, adsenseSlot, adsenseTest } from './adsense';

/**
 * Reserved advertising space (kit docs/05).
 *
 * The box keeps its dimensions whether or not an ad ever fills it, so the page never
 * shifts and never shortens: `--mn-surface`, a 1px border, the size written in the
 * middle, and "Publicidade" in 10px above it, left-aligned. `max-width: 100%` with
 * border-box sizing means no slot can cause horizontal scrolling on a phone.
 *
 * The reservation is marked `data-ad-reserva` and not `data-ad-slot`: the latter is the
 * attribute AdSense reads off the `<ins>` inside it, and two elements answering to the
 * same name would make every selector — ours and Google's — ambiguous.
 *
 * `ordem` makes the accessible name unique when a page carries the same format twice
 * ("Anúncio 1, 728 por 90"), which is what the prototypes do and what axe requires.
 *
 * With AdSense configured for this format (`adsense.ts`), the same box holds a real unit:
 * an `<ins class="adsbygoogle">` that fills the reservation, so the ad lands in space the
 * page already had and Cumulative Layout Shift stays at zero — the reason the kit drew
 * fixed boxes in the first place. Without it, the placeholder stays, and that is the
 * development default.
 *
 * Two details decide whether a unit ever fills, and both come from the design:
 *
 *  - the box is `max-width: 100%`, so a 300-wide rectangle in a 252px column is 252px
 *    wide. A fixed-size unit would simply refuse to serve there, leaving a hole on every
 *    screen narrower than the format. The unit is asked for by *shape*
 *    (`data-ad-format`) instead, and Google fits the best creative it has to the column.
 *  - a live box reserves with `min-height` rather than `height`: a creative slightly
 *    taller than the kit's size grows the box instead of being clipped, which policy
 *    forbids. Shorter creatives leave the reservation exactly as it was.
 *
 * `data-full-width-responsive="false"` keeps a unit from breaking out of the column on a
 * phone, which is the one responsive behaviour this layout cannot absorb.
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
  const client = adsenseClient();
  const slot = adsenseSlot(formato);
  const live = client !== null && slot !== null;

  return (
    <div className={cx('flex flex-col items-center gap-6', sticky && 'sticky top-24 self-start', className)}>
      <span className="self-start text-10 leading-none text-muted">Publicidade</span>
      <div
        role="group"
        aria-label={label}
        data-ad-reserva={formato}
        className={cx(
          'box-border flex max-w-full items-center justify-center border border-line bg-surface text-11 text-muted',
          fluid ? 'w-full' : '',
        )}
        style={
          live
            ? fluid
              ? { maxWidth: width, minHeight: height }
              : { width, minHeight: height }
            : fluid
              ? { maxWidth: width, height }
              : { width, height }
        }
      >
        {live ? (
          <>
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', minHeight: height }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format={fluid ? 'horizontal' : formato === '300x600' ? 'vertical' : 'rectangle'}
              // Breaking out of the column on a phone is the one responsive behaviour this
              // layout cannot absorb.
              data-full-width-responsive="false"
              {...(adsenseTest() ? { 'data-adtest': 'on' } : {})}
            />
            <AdPush />
          </>
        ) : (
          <span aria-hidden="true">
            {width} × {height}
          </span>
        )}
      </div>
    </div>
  );
}
