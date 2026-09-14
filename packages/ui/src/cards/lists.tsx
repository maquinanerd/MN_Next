import Link from 'next/link';

import { AdSlot } from '../ads/AdSlot';
import { cx } from '../lib/cx';
import type { Chamada } from '../model';
import { Kicker } from '../primitives/Kicker';
import { PlayBadge, Photo } from '../primitives/Photo';

type Heading = 'h2' | 'h3';

/**
 * The card with the image above the text: 3/2 image, label, 14px headline, excerpt, time.
 * Used by "Notícias de cinema", Games and "Animes | Especiais".
 *
 * The image link is a duplicate of the headline link, so it is taken out of the tab order
 * and the accessibility tree: one card, one link, one name.
 *
 * The play disc only appears on a video. The prototype puts it on every Games card, which
 * would promise a video that is not there — an icon without a function (kit rules).
 */
export function StandardCard({
  chamada,
  kicker,
  meta,
  showExcerpt = true,
  as: H = 'h3',
  className,
}: {
  chamada: Chamada;
  kicker?: string;
  meta?: string;
  showExcerpt?: boolean;
  as?: Heading;
  className?: string;
}) {
  return (
    <article className={cx('flex min-w-0 flex-col gap-10', className)}>
      {chamada.imagem ? (
        <Link
          href={chamada.href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[3/2] overflow-hidden rounded-mn bg-media"
        >
          <Photo imagem={chamada.imagem} uso="card" decorativa />
          {chamada.formato === 'video' ? <PlayBadge size={34} icon={12} /> : null}
        </Link>
      ) : null}
      {kicker ? (
        <div className="flex items-center gap-6">
          <Kicker color={chamada.editoria.corTexto}>{kicker}</Kicker>
        </div>
      ) : null}
      <H className="m-0 text-14 leading-[1.3] font-bold tracking-[-0.01em]">
        <Link href={chamada.href}>{chamada.titulo}</Link>
      </H>
      {showExcerpt && chamada.resumo ? (
        <p className="m-0 text-12 leading-[1.45] text-excerpt">{chamada.resumo}</p>
      ) : null}
      {meta ? <div className="text-11 text-muted">{meta}</div> : null}
    </article>
  );
}

/** The 16/9 clip card under "Vídeo em destaque". */
export function VideoCard({
  chamada,
  kicker,
  as: H = 'h3',
  className,
}: {
  chamada: Chamada;
  kicker?: string;
  as?: Heading;
  className?: string;
}) {
  return (
    <article className={cx('flex min-w-0 flex-col gap-10', className)}>
      <Link
        href={chamada.href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-video overflow-hidden rounded-mn bg-media"
      >
        {chamada.imagem ? <Photo imagem={chamada.imagem} uso="video" decorativa /> : null}
        <PlayBadge size={30} icon={11} />
      </Link>
      {kicker ? (
        <div className="flex items-center gap-6">
          <Kicker color={chamada.editoria.corTexto}>{kicker}</Kicker>
        </div>
      ) : null}
      <H className="m-0 text-14 leading-[1.3] font-bold tracking-[-0.01em]">
        <Link href={chamada.href}>{chamada.titulo}</Link>
      </H>
    </article>
  );
}

/**
 * SideList — the right-hand column of an opening (kit docs/02): label, 15px… in the
 * prototype 14px headline, time, a 1px rule under each item, no image; closed by the
 * 300×250. On a phone it follows the lead under a rule.
 */
export function SideList({
  itens,
  titulo,
  kicker,
  meta,
  anuncio = true,
  ordemAnuncio,
  className,
}: {
  itens: Chamada[];
  /** "Últimas de / Quadrinhos:" — the second line break is the prototype's. */
  titulo?: [string, string];
  kicker: (c: Chamada) => string | undefined;
  meta: (c: Chamada) => string | undefined;
  anuncio?: boolean;
  /** Ordinal for the 300×250's accessible name when a page carries two. */
  ordemAnuncio?: number;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-16 border-t border-line pt-8 tab:gap-0 tab:border-t-0 tab:pt-0', className)}>
      {titulo ? (
        <h3 className="m-0 mb-6 text-20 leading-[1.15] font-bold tracking-[-0.02em]">
          {titulo[0]}
          <br />
          {titulo[1]}
        </h3>
      ) : null}
      {itens.map((c) => {
        const k = kicker(c);
        const m = meta(c);
        return (
          <article key={c.id} className="flex flex-col gap-8 border-b border-line pt-14 pb-18">
            {k ? (
              <div className="flex items-center gap-6">
                <Kicker color={c.editoria.corTexto}>{k}</Kicker>
              </div>
            ) : null}
            <h3 className="m-0 text-14 leading-[1.3] font-bold tracking-[-0.01em]">
              <Link href={c.href}>{c.titulo}</Link>
            </h3>
            {m ? <div className="text-11 text-muted">{m}</div> : null}
          </article>
        );
      })}
      {anuncio ? (
        <div className="pt-20">
          <AdSlot formato="300x250" {...(ordemAnuncio !== undefined ? { ordem: ordemAnuncio } : {})} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * RowCard — "todas as notícias" (kit docs/02): 296px 3/2 image at the left, label,
 * 17px headline, excerpt, byline. Stacks on a phone, image over text.
 */
export function RowCard({
  chamada,
  kicker,
  meta,
  as: H = 'h3',
}: {
  chamada: Chamada;
  kicker?: string;
  meta?: string;
  as?: Heading;
}) {
  return (
    <article
      className={cx(
        'grid grid-cols-1 gap-14 border-b border-line py-24 tab:gap-32',
        chamada.imagem ? 'tab:grid-cols-[296px_minmax(0,1fr)]' : '',
      )}
    >
      {chamada.imagem ? (
        <Link
          href={chamada.href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[3/2] overflow-hidden rounded-mn bg-media"
        >
          <Photo imagem={chamada.imagem} uso="row" decorativa />
          {chamada.formato === 'video' ? <PlayBadge size={34} icon={12} /> : null}
        </Link>
      ) : null}
      <div className="flex flex-col gap-10 tab:max-w-520">
        {kicker ? <Kicker color={chamada.editoria.corTexto}>{kicker}</Kicker> : null}
        <H className="m-0 text-17 leading-[1.3] font-bold tracking-[-0.015em]">
          <Link href={chamada.href}>{chamada.titulo}</Link>
        </H>
        {chamada.resumo ? <p className="m-0 text-13 leading-[1.5] text-excerpt">{chamada.resumo}</p> : null}
        {meta ? <div className="mt-4 text-11 text-ink-3">{meta}</div> : null}
      </div>
    </article>
  );
}
