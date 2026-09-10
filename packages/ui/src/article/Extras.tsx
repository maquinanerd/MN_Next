import Link from 'next/link';

import { OverlayCard } from '../cards/overlay';
import { cx } from '../lib/cx';
import { assinatura, mesAno } from '../lib/format';
import type { Chamada, Imagem } from '../model';
import { Photo } from '../primitives/Photo';
import { SectionTitle } from '../primitives/SectionTitle';

/** The natural ratio of an image when known, else 16/9; clamped so no figure is a sliver. */
function ratioOf(imagem: Imagem, fallback: string): string {
  if (!imagem.largura || !imagem.altura) return fallback;
  const r = imagem.largura / imagem.altura;
  const clamped = Math.min(Math.max(r, 4 / 3), 21 / 9);
  return `${clamped.toFixed(4)}`;
}

/**
 * WideFigure (kit docs/02): the image breaks out of the text column by 72px on each side,
 * the credit in 10px italic underneath, aligned back to the text column. Above 1240px only;
 * narrower, it stays in the column.
 */
export function WideFigure({
  imagem,
  capa = false,
  priority = false,
  className,
}: {
  imagem: Imagem;
  /** The article cover: a fixed 2:1 crop, as the prototype frames it. */
  capa?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const caption = capa
    ? imagem.credito
      ? `Crédito da imagem: ${imagem.credito}`
      : imagem.legenda
    : [imagem.legenda, imagem.credito ? `(Crédito: ${imagem.credito})` : null].filter(Boolean).join(' ');
  return (
    <figure className={cx('mx-0 wide:-mx-72', className)}>
      <div
        className="relative overflow-hidden rounded-mn bg-media"
        style={{ aspectRatio: capa ? '640 / 320' : ratioOf(imagem, '16 / 9') }}
      >
        <Photo imagem={imagem} uso="figure" priority={priority} />
      </div>
      {caption ? (
        <figcaption className={cx('mt-8 text-10 text-muted italic wide:mx-72', !capa && 'max-w-420')}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * RelatedInline — "Mais como este" (kit docs/02): three 15px headlines stacked beside a
 * 280px 3/2 image, vertically centred, between two rules.
 */
export function RelatedInline({
  itens,
  imagem,
  mais,
}: {
  itens: Chamada[];
  imagem?: Imagem;
  mais?: { rotulo: string; href: string };
}) {
  const imageHref = itens[0]?.href;
  return (
    <section aria-labelledby="mais-como-este" className="my-40 border-y border-line py-28">
      <SectionTitle id="mais-como-este" forte="Mais" fraco="como este" size={18} className="mb-18" />
      <div className="flex flex-col items-center gap-40 tab:flex-row">
        <ul className="m-0 flex w-full flex-1 list-none flex-col gap-14 p-0 text-15 leading-[1.35] font-semibold tracking-[-0.01em]">
          {itens.map((c) => (
            <li key={c.id}>
              <Link href={c.href}>{c.titulo}</Link>
            </li>
          ))}
          {mais ? (
            <li className="mt-8">
              <Link
                href={mais.href}
                className="w-max text-12 font-normal text-ink-3 underline decoration-underline underline-offset-3"
              >
                {mais.rotulo}
              </Link>
            </li>
          ) : null}
        </ul>
        {imagem && imageHref ? (
          <Link
            href={imageHref}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[3/2] w-full flex-none overflow-hidden rounded-mn bg-media tab:w-280"
          >
            <Photo imagem={imagem} uso="related" decorativa />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The closing note: where to comment and the newsletter. The prototype's sentence calls
 * the newsletter "semanal" and describes its contents; neither is a fact we have, so
 * neither is said (kit rules: no invented periodicity).
 */
export function EndNotes({
  facebook,
  x,
  newsletter,
  children,
}: {
  facebook: string;
  x: string;
  newsletter: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-40 border-t border-line pt-32">
      <p className="m-0 text-12 leading-[1.6] text-note">
        Se quiser comentar esta reportagem ou qualquer outra coisa que viu no Máquina Nerd, vá até a nossa página no{' '}
        <a href={facebook} rel="noopener" className="text-(--mn-hover) underline decoration-1 underline-offset-3">
          Facebook
        </a>{' '}
        ou mande uma mensagem no{' '}
        <a href={x} rel="noopener" className="text-(--mn-hover) underline decoration-1 underline-offset-3">
          X
        </a>
        .
      </p>
      <p className="mt-10 mb-0 text-12 leading-[1.6] text-note">
        E se gostou desta história,{' '}
        <Link href={newsletter} className="text-(--mn-hover) underline decoration-1 underline-offset-3">
          inscreva-se na newsletter do Máquina Nerd
        </Link>
        .
      </p>
      {children}
    </div>
  );
}

/**
 * The next story: a filled editoria label and the month, a 400-weight 18px headline, the
 * excerpt, "Ler a notícia", and a 296×200 image at the right.
 */
export function NextStory({ chamada }: { chamada: Chamada }) {
  const ed = chamada.editoria;
  const on = ed.textoSobreCor === 'light' ? 'var(--color-white)' : 'var(--color-ink)';
  return (
    <section aria-label="Próxima matéria" className="mt-48 border-t border-line pt-40">
      <div className="grid grid-cols-1 items-start gap-40 tab:grid-cols-[minmax(0,1fr)_296px]">
        <div className="flex max-w-300 flex-col gap-14">
          <div className="flex items-center gap-14">
            <span className="px-14 py-3 text-11" style={{ background: ed.corFundoTexto, color: on }}>
              {ed.nome}
            </span>
            <span className="text-11 text-muted">{mesAno(chamada.publicadoEm)}</span>
          </div>
          <h2 className="mt-8 mb-0 text-18 leading-[1.25] font-normal">
            <Link href={chamada.href}>{chamada.titulo}</Link>
          </h2>
          {chamada.resumo ? <p className="m-0 text-12 leading-[1.5] text-excerpt">{chamada.resumo}</p> : null}
          <Link
            href={chamada.href}
            className="mt-10 w-max text-11 text-muted underline decoration-underline underline-offset-3"
            aria-label={`Ler a notícia: ${chamada.titulo}`}
          >
            Ler a notícia
          </Link>
        </div>
        {chamada.imagem ? (
          <Link
            href={chamada.href}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[296/200] overflow-hidden rounded-mn bg-media"
          >
            <Photo imagem={chamada.imagem} uso="row" decorativa />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** "NOTÍCIAS RELACIONADAS": three columns of overlay cards, the byline as their meta. */
export function RelatedGrid({ itens }: { itens: Chamada[] }) {
  if (itens.length === 0) return null;
  return (
    <section aria-labelledby="relacionadas" className="mt-48 border-t border-line pt-40 pb-56">
      <SectionTitle id="relacionadas" forte="Notícias" fraco="relacionadas" size={22} className="mb-24" />
      <div className="grid grid-cols-1 gap-14 tab:grid-cols-3 tab:gap-24">
        {itens.map((c) => (
          <OverlayCard
            key={c.id}
            chamada={c}
            kicker={c.editoria.nome}
            meta={assinatura((c.autores ?? []).map((a) => a.nome)) || undefined}
          />
        ))}
      </div>
    </section>
  );
}
