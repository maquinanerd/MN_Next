import Link from 'next/link';

import { cx } from '../lib/cx';

type Size = 26 | 22 | 18 | 16;

const SIZE: Record<Size, string> = {
  26: 'text-20 tab:text-26',
  22: 'text-22',
  18: 'text-18',
  16: 'text-16',
};

/**
 * Section title with the system's mixed weight: the first word in 800, the rest in 300,
 * uppercase, -.02em (`NOTÍCIAS de cinema`). 26px on home and editoria (20px on mobile),
 * 22px under an article, 18px for "Mais como este".
 *
 * `acao` is the outline button the prototypes put at the right end ("Ver Games").
 */
export function SectionTitle({
  forte,
  fraco,
  as: Tag = 'h2',
  size = 26,
  id,
  acao,
  className,
}: {
  forte: string;
  fraco?: string;
  as?: 'h2' | 'h3';
  size?: Size;
  id?: string;
  acao?: { rotulo: string; href: string };
  className?: string;
}) {
  return (
    <div className={cx('flex items-center gap-12', className)}>
      <Tag id={id} className={cx('m-0 leading-[1.1] font-extrabold tracking-[-0.02em] uppercase', SIZE[size])}>
        {forte}
        {fraco ? <span className="font-light"> {fraco}</span> : null}
      </Tag>
      {acao ? (
        <Link
          href={acao.href}
          className="ml-auto flex min-h-40 flex-none items-center border border-control px-40 py-9 text-12 text-ink hover:text-(--mn-hover)"
        >
          {acao.rotulo}
        </Link>
      ) : null}
    </div>
  );
}
