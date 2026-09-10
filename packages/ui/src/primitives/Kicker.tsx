import { cx } from '../lib/cx';

/**
 * The label above a headline: 12px, 700, -.01em. On white it takes the editoria's text
 * variant (≥4.5:1); on a photo it is white. Never a pill, never uppercase (docs/01).
 */
export function Kicker({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  /** A CSS colour value; omit for inherited (white on photos). */
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx('text-12 leading-none font-bold tracking-[-0.01em]', className)}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}
