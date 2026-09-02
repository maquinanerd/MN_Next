import type { ReactNode } from 'react';

/** Shell (1440) for header, home and network chrome. */
export function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `mn-shell ${className}` : 'mn-shell'}>{children}</div>;
}

/** Editorial container (1240) for article, category and every reading surface. */
export function Editorial({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `mn-editorial ${className}` : 'mn-editorial'}>{children}</div>;
}

export function Dossier({ children }: { children: ReactNode }) {
  return <div className="mn-dossier">{children}</div>;
}

/**
 * The single section-heading pattern: uppercase label plus a rule to the right margin.
 *
 * The audit found three competing patterns in the prototypes and collapsed them into
 * this one. It renders a real `<h2>` even though it looks like a 13px label, so the
 * document outline is correct for a screen reader.
 */
export function SectionHeading({
  label,
  href,
  linkLabel = 'Ver todas',
  tone = 'light',
  as: As = 'h2',
  accent,
}: {
  label: string;
  href?: string;
  linkLabel?: string;
  tone?: 'light' | 'dark';
  as?: 'h2' | 'h3';
  /** A word set in brand red before the label, as in "**Especial** · Star Wars". */
  accent?: string;
}) {
  return (
    <div className={tone === 'dark' ? 'mn-sectionheading mn-sectionheading--dark' : 'mn-sectionheading'}>
      <As className="mn-sectionheading__label">
        {accent ? (
          <>
            <span className="mn-sectionheading__accent">{accent}</span> ·{' '}
          </>
        ) : null}
        {label}
      </As>
      <span className="mn-sectionheading__rule" aria-hidden="true" />
      {href ? (
        <a className="mn-sectionheading__link" href={href}>
          {linkLabel}
        </a>
      ) : null}
    </div>
  );
}

export function Skeleton({ height, radius = 8 }: { height: number | string; radius?: number }) {
  return (
    <div
      className="mn-skeleton"
      style={{ height: typeof height === 'number' ? `${height}px` : height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Time element with a machine-readable `dateTime`, as the a11y doc requires. */
export function DateTime({ iso, className }: { iso: string; className?: string }) {
  const date = new Date(iso);
  const label = Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
      })
        .format(date)
        .replace('.', '');
  return (
    <time dateTime={iso} {...(className ? { className } : {})}>
      {label}
    </time>
  );
}

export function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

export function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
