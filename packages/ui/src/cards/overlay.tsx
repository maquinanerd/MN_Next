import Link from 'next/link';

import { cx } from '../lib/cx';
import type { Chamada } from '../model';
import { Kicker } from '../primitives/Kicker';
import { PlayBadge, Photo } from '../primitives/Photo';

type Heading = 'h2' | 'h3';

interface OverlayProps {
  chamada: Chamada;
  kicker?: string;
  meta?: string;
  as?: Heading;
  priority?: boolean;
  className?: string;
}

/*
 * The photo cards: the whole card is the link, as in the prototypes, with the headline as
 * a real heading inside it. The link colour is pinned to white so the global link hover
 * never paints a headline red on a photograph.
 */
const photoLink = 'relative block min-w-0 overflow-hidden rounded-mn bg-ink text-white hover:text-white';

/**
 * HeroCard — the one lead per page (kit docs/02).
 *
 * 16/8 with a 300px floor on desktop, 4/3 on a phone; label at the top left, headline
 * clamp(22px, 2vw, 30px) at 800, excerpt, time. `variante="pick"` is the second lead of
 * the home ("Notícias de Séries e TV"), which the prototype gives a slightly heavier scrim.
 */
export function HeroCard({
  chamada,
  kicker,
  meta,
  as: H = 'h2',
  priority,
  variante = 'abertura',
  className,
}: OverlayProps & { variante?: 'abertura' | 'pick' }) {
  return (
    <Link href={chamada.href} className={cx(photoLink, 'aspect-[4/3] tab:aspect-[16/8] tab:min-h-300', className)}>
      {chamada.imagem ? <Photo imagem={chamada.imagem} uso="hero" priority={priority} decorativa /> : null}
      <span aria-hidden="true" className={cx('absolute inset-0', variante === 'pick' ? 'scrim-pick' : 'scrim-hero')} />
      {kicker ? (
        <span className="absolute top-20 left-20 flex items-center gap-7">
          <Kicker>{kicker}</Kicker>
        </span>
      ) : null}
      <span className="absolute inset-x-16 bottom-16 flex flex-col gap-8 tab:inset-x-20 tab:bottom-20 tab:max-w-420">
        <H className="m-0 text-22 leading-[1.12] font-extrabold tracking-[-0.03em] tab:text-[clamp(22px,2vw,30px)]">
          {chamada.titulo}
        </H>
        {chamada.resumo ? <span className="text-13 leading-[1.45] text-white/82">{chamada.resumo}</span> : null}
        {meta ? <span className="mt-8 text-11 text-white/60">{meta}</span> : null}
      </span>
    </Link>
  );
}

/**
 * OverlayCard — headline on the photo (kit docs/02). 4/3; 3/4 between 761 and 1100px,
 * where three of them share a narrow row; 16/10 on a phone. Title clamped to three lines.
 */
export function OverlayCard({ chamada, kicker, meta, as: H = 'h3', className }: OverlayProps) {
  return (
    <Link href={chamada.href} className={cx(photoLink, 'aspect-[16/10] tab:aspect-[3/4] lg:aspect-[4/3]', className)}>
      {chamada.imagem ? <Photo imagem={chamada.imagem} uso="overlay" decorativa /> : null}
      <span aria-hidden="true" className="absolute inset-0 scrim-card" />
      {kicker ? (
        <span className="absolute top-16 left-16 flex items-center gap-6">
          <Kicker>{kicker}</Kicker>
        </span>
      ) : null}
      <span className="absolute inset-x-14 bottom-14 flex flex-col gap-6 tab:inset-x-16 tab:bottom-16">
        <H className="clamp-3 m-0 text-16 leading-[1.25] font-bold tracking-[-0.015em] tab:text-15">{chamada.titulo}</H>
        {meta ? <span className="text-11 text-white/60">{meta}</span> : null}
      </span>
    </Link>
  );
}

/**
 * BigCard — the wide overlay in the middle of a section (kit docs/02). Spans two of the
 * four columns with a 300px floor; 16/10 on a phone.
 */
export function BigCard({ chamada, kicker, meta, as: H = 'h3', className }: OverlayProps) {
  return (
    <Link
      href={chamada.href}
      className={cx(photoLink, 'aspect-[16/10] tab:col-span-2 tab:aspect-auto tab:min-h-300', className)}
    >
      {chamada.imagem ? <Photo imagem={chamada.imagem} uso="big" decorativa /> : null}
      <span aria-hidden="true" className="absolute inset-0 scrim-big" />
      {kicker ? (
        <span className="absolute top-20 left-20 flex items-center gap-7">
          <Kicker>{kicker}</Kicker>
        </span>
      ) : null}
      <span className="absolute inset-x-20 bottom-20 flex max-w-380 flex-col gap-8">
        <H className="m-0 text-20 leading-[1.15] font-extrabold tracking-[-0.03em]">{chamada.titulo}</H>
        {chamada.resumo ? <span className="text-12 leading-[1.45] text-white/82">{chamada.resumo}</span> : null}
        {meta ? <span className="mt-8 text-11 text-white/60">{meta}</span> : null}
      </span>
    </Link>
  );
}

/**
 * The home's "Vídeo em destaque": a 420px-tall lead with a play disc, 4/3 on a phone.
 */
export function FeatureVideoCard({ chamada, kicker, as: H = 'h3', className }: OverlayProps) {
  return (
    <Link href={chamada.href} className={cx(photoLink, 'aspect-[4/3] tab:aspect-auto tab:min-h-420', className)}>
      {chamada.imagem ? <Photo imagem={chamada.imagem} uso="feature" decorativa /> : null}
      <span aria-hidden="true" className="absolute inset-0 scrim-video" />
      <PlayBadge size={48} icon={16} />
      {kicker ? (
        <span className="absolute top-20 left-20 flex items-center gap-7">
          <Kicker>{kicker}</Kicker>
        </span>
      ) : null}
      <span className="absolute inset-x-16 bottom-16 flex flex-col gap-8 tab:inset-x-20 tab:bottom-24 tab:max-w-420">
        <H className="m-0 text-22 leading-[1.15] font-extrabold tracking-[-0.03em] tab:text-20">{chamada.titulo}</H>
        {chamada.resumo ? <span className="text-12 leading-[1.45] text-white/82">{chamada.resumo}</span> : null}
      </span>
    </Link>
  );
}
