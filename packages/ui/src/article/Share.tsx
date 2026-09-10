import { cx } from '../lib/cx';
import { ShareChip } from './ShareChip';

/**
 * The four share circles (30px, 1px border, 10px/700 glyph) the prototypes put beside the
 * headline and under the text: "in", "f", "X", "G". Each one is a real share link — a
 * glyph with no destination would be an icon without a function. "G" opens a Gmail
 * draft, which is the only reading of the glyph that shares anything.
 */
export function ShareButtons({ titulo, url, className }: { titulo: string; url: string; className?: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);
  const targets = [
    {
      glyph: 'in',
      label: 'Compartilhar no LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    { glyph: 'f', label: 'Compartilhar no Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { glyph: 'X', label: 'Compartilhar no X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { glyph: 'G', label: 'Enviar pelo Gmail', href: `https://mail.google.com/mail/?view=cm&su=${t}&body=${u}` },
  ];
  return (
    <div className={cx('flex gap-6', className)}>
      {targets.map((s) => (
        <a
          key={s.glyph}
          href={s.href}
          aria-label={s.label}
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-30 items-center justify-center rounded-full border border-control text-10 font-bold text-ink"
        >
          <span aria-hidden="true">{s.glyph}</span>
        </a>
      ))}
    </div>
  );
}

/** The closing share row: the four circles and the "‹ Compartilhar" chip. */
export function ShareRow({ titulo, url }: { titulo: string; url: string }) {
  return (
    <div className="mt-24 flex flex-wrap items-center gap-6">
      <ShareButtons titulo={titulo} url={url} />
      <ShareChip titulo={titulo} url={url} />
    </div>
  );
}
