import Link from 'next/link';

/**
 * Numbered pagination.
 *
 * Every page is its own canonical URL and page 2 never points at page 1 (docs/06), so
 * these are real links with real hrefs - not a "load more" button that leaves the
 * archive unreachable to a crawler.
 *
 * `total` is null when the CMS paginates by cursor and cannot produce a count; the
 * control then degrades to previous/next, which is honest rather than inventing a
 * last-page number.
 */
export interface PaginationProps {
  page: number;
  totalPages: number | null;
  hasNext: boolean;
  /** `(page) => href`; page 1 must map to the unpaginated URL. */
  hrefFor: (page: number) => string;
}

function windowed(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('gap');
    out.push(p);
    previous = p;
  }
  return out;
}

export function Pagination({ page, totalPages, hasNext, hrefFor }: PaginationProps) {
  if (totalPages !== null && totalPages <= 1) return null;

  return (
    <nav className="mn-pagination" aria-label="Paginação">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" aria-label="Página anterior">
          ←
        </Link>
      ) : null}

      {totalPages !== null ? (
        windowed(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span className="mn-pagination__gap" key={`gap-${index}`} aria-hidden="true">
              …
            </span>
          ) : entry === page ? (
            <span key={entry} aria-current="page">
              {entry.toLocaleString('pt-BR')}
            </span>
          ) : (
            <Link key={entry} href={hrefFor(entry)}>
              {entry.toLocaleString('pt-BR')}
            </Link>
          ),
        )
      ) : (
        <span aria-current="page">{page.toLocaleString('pt-BR')}</span>
      )}

      {hasNext ? (
        <Link href={hrefFor(page + 1)} rel="next" aria-label="Próxima página">
          →
        </Link>
      ) : null}
    </nav>
  );
}
