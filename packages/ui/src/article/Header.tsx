import Image from 'next/image';
import Link from 'next/link';

import { SIZES } from '@mn/tokens';

import { cx } from '../lib/cx';
import { dataHora, dataLonga } from '../lib/format';
import type { Autor, Materia } from '../model';
import { Photo } from '../primitives/Photo';
import { ShareButtons } from './Share';

/** "Cinema · Marvel" — 13px, 700, in the editoria's text colour. */
export function ArticleLabel({ materia, color }: { materia: Materia; color?: string }) {
  return (
    <span className="text-13 font-bold tracking-[-0.01em]" style={{ color: color ?? materia.editoria.corTexto }}>
      {materia.editoria.nome}
      {materia.assunto ? ` · ${materia.assunto}` : ''}
    </span>
  );
}

/**
 * ArticleHeader (kit docs/02): the label, the h1 and the share circles on one row. The
 * h1 is 28px/800/-.035em (25px on a phone, where the row stacks).
 */
export function ArticleTitleRow({ materia }: { materia: Materia }) {
  return (
    <div className="mt-24 flex flex-col items-start gap-24 tab:flex-row">
      <h1 className="m-0 flex-1 text-25 leading-[1.12] font-extrabold tracking-[-0.035em] tab:text-28">
        {materia.titulo}
      </h1>
      <ShareButtons titulo={materia.titulo} url={materia.url} className="mt-6 flex-none" />
    </div>
  );
}

/**
 * The disclosure of a sponsored, campaign or review-sample article, above the text: what
 * the reader is looking at is said before the reading starts (kit docs/05).
 */
export function Disclosure({
  divulgacao,
  className,
}: {
  divulgacao: { rotulo: string; texto: string };
  className?: string;
}) {
  return (
    <p role="note" className={cx('mb-0 border-l-2 border-mn-red pl-10 text-12 leading-[1.5] text-note', className)}>
      <strong className="font-bold text-ink">{divulgacao.rotulo}.</strong> {divulgacao.texto}
    </p>
  );
}

/** The lead ("linha fina"): 19px/500/-.01em, 17px on a phone. */
export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-24 mb-0 text-17 leading-[1.4] font-medium tracking-[-0.01em] tab:text-19">{children}</p>;
}

/** "Publicado em …" and, only when it differs, "Atualizado em …" (docs/04). */
export function Dates({ materia, inline = false }: { materia: Materia; inline?: boolean }) {
  if (inline) {
    return (
      <span className="text-11 text-byline">
        Publicado em {dataLonga(materia.publicadoEm)}
        {materia.atualizadoEm ? ` · atualizado em ${dataHora(materia.atualizadoEm)}` : ''}
      </span>
    );
  }
  return (
    <>
      <div>Publicado em {dataLonga(materia.publicadoEm)}</div>
      {materia.atualizadoEm ? <div className="text-muted">Atualizado em {dataHora(materia.atualizadoEm)}</div> : null}
    </>
  );
}

function Avatar({ autor, size }: { autor: Autor; size: 40 | 44 | 52 }) {
  if (!autor.avatar) return null;
  return (
    <span
      className="relative block flex-none overflow-hidden rounded-full bg-media"
      style={{ width: size, height: size }}
    >
      <Image src={autor.avatar} alt="" fill sizes={`${size}px`} className="object-cover" />
    </span>
  );
}

/**
 * The byline row the overlay and commercial variants use in place of the author rail:
 * avatar (only a real portrait — never an initials disc), name, dates; the overlay also
 * carries the share circles at the right.
 */
export function AuthorRow({
  materia,
  por = false,
  share = false,
  size = 44,
  className,
}: {
  materia: Materia;
  por?: boolean;
  share?: boolean;
  size?: 40 | 44;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-24 border-b border-line', className)}>
      <div className="flex items-center gap-14">
        {materia.autores[0] ? <Avatar autor={materia.autores[0]} size={size} /> : null}
        <span className="flex flex-col gap-3">
          {materia.autores.length > 0 ? (
            <span className="text-14 font-extrabold tracking-[-0.02em]">
              {por ? 'Por ' : ''}
              {materia.autores.map((a, i) => (
                <span key={a.slug}>
                  {i > 0 ? (i === materia.autores.length - 1 ? ' e ' : ', ') : ''}
                  <Link href={a.href}>{a.nome}</Link>
                </span>
              ))}
            </span>
          ) : null}
          <Dates materia={materia} inline />
        </span>
      </div>
      {share ? <ShareButtons titulo={materia.titulo} url={materia.url} /> : null}
    </div>
  );
}

/**
 * FullBleedCover — the overlay variant's opening (kit docs/02): the cover across the
 * whole width, `clamp(360px, 62vh, 640px)` tall, the header on top of it in white, label
 * and headline over the photo, the credit in the lower right corner.
 *
 * The prototype makes this `100vh`; the kit's spec gives the clamp, and a full-screen
 * portrait composition is exactly what docs/06 rules out on a phone.
 */
export function FullBleedCover({ materia, header }: { materia: Materia; header: React.ReactNode }) {
  const credit = materia.imagem?.credito;
  return (
    <div className="relative flex flex-col bg-ink text-white" style={{ minHeight: 'clamp(360px, 62vh, 640px)' }}>
      {materia.imagem ? <Photo imagem={materia.imagem} uso="cover" priority /> : null}
      <span aria-hidden="true" className="absolute inset-0 scrim-cover" />
      {header}
      {/*
       * The headline sits on the photo, outside <main> (the header shares the photo, and a
       * header inside <main> stops being a banner). A labelled region keeps it inside a
       * landmark, and it is where "Ir para o conteúdo" lands.
       */}
      <section
        id="conteudo"
        tabIndex={-1}
        aria-labelledby="titulo-materia"
        className="wrap relative z-2 flex flex-1 flex-col items-start justify-end gap-16 pt-48 pb-40 outline-none tab:pt-80 tab:pb-56"
      >
        <div className="flex max-w-820 flex-col gap-16 text-left">
          <span className="text-13 font-bold tracking-[-0.01em] text-white/90">
            {materia.editoria.nome}
            {materia.assunto ? ` · ${materia.assunto}` : ''}
          </span>
          <h1
            id="titulo-materia"
            className="m-0 max-w-820 text-26 leading-[1.04] font-extrabold tracking-[-0.035em] tab:text-[clamp(32px,4.2vw,60px)]"
          >
            {materia.titulo}
          </h1>
          {materia.resumo && materia.resumo !== materia.lead ? (
            <p className="m-0 max-w-720 text-[clamp(15px,1.2vw,18px)] leading-[1.5] text-white/92">{materia.resumo}</p>
          ) : null}
        </div>
      </section>
      {credit ? (
        <span className="absolute right-12 bottom-10 z-2 text-10 text-white/60 italic">
          Crédito da imagem: {credit}
        </span>
      ) : null}
    </div>
  );
}

export { SIZES };
