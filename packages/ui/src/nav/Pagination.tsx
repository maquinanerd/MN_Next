import Link from 'next/link';

import { cx } from '../lib/cx';
import type { Paginacao } from '../model';

type Item = number | 'gap';

/**
 * Which page numbers to show: `1 2 3 4 … 24` at the start, the current page with its
 * neighbours in the middle, the last four at the end. With no total (cursor pagination)
 * it shows what is knowable: the pages up to the current one, and the next if it exists.
 */
export function pageItems(atual: number, total: number | null, temProxima: boolean): Item[] {
  if (total === null) {
    const last = temProxima ? atual + 1 : atual;
    if (last <= 5) return Array.from({ length: last }, (_, i) => i + 1);
    return [1, 'gap', ...Array.from({ length: last - atual + 2 }, (_, i) => atual - 1 + i)];
  }
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (atual <= 3) return [1, 2, 3, 4, 'gap', total];
  if (atual >= total - 2) return [1, 'gap', total - 3, total - 2, total - 1, total];
  return [1, 'gap', atual - 1, atual, atual + 1, 'gap', total];
}

const box = 'box-border flex h-36 items-center justify-center border text-13 font-semibold';

/**
 * Numbered pagination (kit docs/03): 36px squares, the current one filled, ellipses in
 * `--mn-muted`, arrows either side. The current page is `aria-current="page"`; an arrow
 * with nowhere to go is not a link. Wraps onto several lines on a phone.
 */
export function Pagination({
  paginacao,
  hrefPara,
  cor = 'var(--color-mn-red)',
  textoSobreCor = 'light',
  className,
}: {
  paginacao: Paginacao;
  hrefPara: (page: number) => string;
  /** Fill of the current page: brand red on the home, the editoria's fill on an editoria. */
  cor?: string;
  textoSobreCor?: 'light' | 'dark';
  className?: string;
}) {
  const { atual, total, temProxima } = paginacao;
  if (atual === 1 && !temProxima) return null;
  const items = pageItems(atual, total, temProxima);
  const onFill = textoSobreCor === 'light' ? 'var(--color-white)' : 'var(--color-ink)';

  return (
    <nav aria-label="Paginação" className={cx('mt-40 flex flex-wrap items-center justify-center gap-6', className)}>
      {atual > 1 ? (
        <Link
          href={hrefPara(atual - 1)}
          aria-label="Página anterior"
          className={cx(box, 'w-36 border-control text-14 text-ink')}
        >
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(box, 'w-36 border-control text-14 text-muted')}>
          ‹
        </span>
      )}
      {items.map((item, index) =>
        item === 'gap' ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className={cx(box, 'min-w-36 border-transparent px-10 text-muted')}
          >
            …
          </span>
        ) : item === atual ? (
          <span
            key={item}
            aria-current="page"
            className={cx(box, 'min-w-36 px-10')}
            style={{ background: cor, borderColor: cor, color: onFill }}
          >
            <span className="sr-only">Página </span>
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefPara(item)} className={cx(box, 'min-w-36 border-control px-10 text-ink')}>
            <span className="sr-only">Página </span>
            {item}
          </Link>
        ),
      )}
      {temProxima ? (
        <Link
          href={hrefPara(atual + 1)}
          aria-label="Próxima página"
          className={cx(box, 'w-36 border-control text-14 text-ink')}
        >
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(box, 'w-36 border-control text-14 text-muted')}>
          ›
        </span>
      )}
    </nav>
  );
}
