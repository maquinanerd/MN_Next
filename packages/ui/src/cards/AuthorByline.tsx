import Link from 'next/link';
import type { Author } from '@mn/content';

import { ClockIcon, DateTime } from '../primitives/misc';

/**
 * Byline with the prototype's initials avatar.
 *
 * The avatar colour comes from a deterministic hash of the author id (see
 * `@mn/tokens`), so it is identical on the server and the client - a per-render random
 * colour would visibly change on hydration.
 */
export interface AuthorBylineProps {
  authors: Author[];
  date: string;
  size?: 'sm' | 'md';
  withAvatar?: boolean;
  /** Rendered after the date, e.g. "4 min de leitura". */
  suffix?: string;
}

export function AuthorByline({ authors, date, size = 'md', withAvatar = true, suffix }: AuthorBylineProps) {
  const primary = authors[0];
  return (
    <div className={size === 'sm' ? 'mn-byline mn-byline--sm' : 'mn-byline'}>
      <span className="mn-byline__time">
        <ClockIcon />
        <DateTime iso={date} />
        {suffix ? <span> · {suffix}</span> : null}
      </span>
      {primary ? (
        <span className="mn-byline__author">
          {withAvatar ? (
            <span className="mn-byline__avatar" style={{ background: primary.avatarColor }} aria-hidden="true">
              {primary.initials}
            </span>
          ) : null}{' '}
          por{' '}
          <span className="mn-byline__name">
            <Link href={`/autor/${primary.slug}`}>{primary.name}</Link>
          </span>
          {authors.length > 1 ? <span> e mais {authors.length - 1}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
