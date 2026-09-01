import Link from 'next/link';
import type { ReactNode } from 'react';

import { Skeleton } from '../primitives/misc';

/**
 * Loading, empty and error states.
 *
 * The prototypes never designed these (audit debt 4), so they are built from the token
 * system as neutral, accessible defaults: skeletons reserve the exact dimensions of the
 * content they stand in for, empty states explain rather than apologise, and error
 * states offer a recovery path and a correlation id an operator can search for.
 */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mn-state" role="status">
      <p className="mn-state__title">{title}</p>
      <p className="mn-state__text">{description}</p>
      {action ? (
        <Link className="mn-button" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'Não foi possível carregar este conteúdo',
  description = 'A falha foi registrada e a redação já foi avisada. Tente novamente em alguns instantes.',
  correlationId,
  retry,
}: {
  title?: string;
  description?: string;
  correlationId?: string;
  retry?: ReactNode;
}) {
  return (
    <div className="mn-state" role="alert">
      <p className="mn-state__title">{title}</p>
      <p className="mn-state__text">{description}</p>
      {retry}
      {correlationId ? <p className="mn-state__code">Referência: {correlationId}</p> : null}
    </div>
  );
}

/** Card grid skeleton with the real card dimensions, so nothing shifts on arrival. */
export function GridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: 2 | 3 | 4 }) {
  return (
    <div className={`mn-grid mn-grid--${columns}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="mn-card" key={i}>
          <div style={{ aspectRatio: '343 / 193' }}>
            <Skeleton height="100%" />
          </div>
          <Skeleton height={14} radius={4} />
          <Skeleton height={14} radius={4} />
          <Skeleton height={12} radius={4} />
        </div>
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div className="mn-editorial" aria-hidden="true">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBlock: 32 }}>
        <Skeleton height={16} radius={4} />
        <Skeleton height={52} radius={6} />
        <Skeleton height={20} radius={4} />
        <div style={{ aspectRatio: '16 / 9' }}>
          <Skeleton height="100%" />
        </div>
        <Skeleton height={14} radius={4} />
        <Skeleton height={14} radius={4} />
        <Skeleton height={14} radius={4} />
      </div>
    </div>
  );
}
