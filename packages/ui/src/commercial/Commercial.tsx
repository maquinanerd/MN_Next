import Link from 'next/link';

import { AdSlot } from '../ads/AdSlot';
import type { Chamada, Patrocinado, Produto } from '../model';
import { Photo } from '../primitives/Photo';

/**
 * ProductCard (kit docs/02 and 05): a 200px 1/1 image, "Oferta · link de afiliado", name,
 * description, the price in `--mn-red-text` with the old price struck through, one or two
 * store buttons naming the store. Every outbound link is `rel="sponsored nofollow"`.
 *
 * A price is shown only when the data has one; `demonstracao` adds the "preço de
 * demonstração" marker. Nothing here computes a discount or a countdown.
 */
export function ProductCard({ produto }: { produto: Produto }) {
  const first = produto.ofertas[0];
  const image = (
    <span className="relative block aspect-square overflow-hidden bg-product">
      <Photo imagem={produto.imagem} uso="product" />
    </span>
  );
  return (
    <div className="mt-28 grid grid-cols-1 items-center gap-24 border border-line p-20 desk:grid-cols-[200px_minmax(0,1fr)]">
      {first ? (
        <a
          href={first.url}
          rel="sponsored nofollow noopener noreferrer"
          target="_blank"
          tabIndex={-1}
          aria-hidden="true"
        >
          {image}
        </a>
      ) : (
        image
      )}
      <div className="flex min-w-0 flex-col gap-10">
        <span className="text-10 font-bold tracking-[0.04em] text-ink-3 uppercase">Oferta · link de afiliado</span>
        <h3 className="m-0 text-17 leading-[1.25] font-extrabold tracking-[-0.02em]">{produto.nome}</h3>
        <p className="m-0 text-13 leading-[1.5] text-byline">{produto.descricao}</p>
        {produto.precoAtual ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-10">
            <span className="text-22 font-extrabold tracking-[-0.02em] text-mn-red-text">{produto.precoAtual}</span>
            {produto.precoAnterior ? (
              <span className="text-12 text-ink-3 line-through">
                <span className="sr-only">Preço anterior: </span>
                {produto.precoAnterior}
              </span>
            ) : null}
            {produto.demonstracao ? <span className="text-10 text-muted">preço de demonstração</span> : null}
          </div>
        ) : null}
        {produto.ofertas.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-8">
            {produto.ofertas.slice(0, 2).map((oferta, i) => (
              <a
                key={oferta.loja}
                href={oferta.url}
                rel="sponsored nofollow noopener noreferrer"
                target="_blank"
                className={
                  i === 0
                    ? 'inline-flex h-40 items-center gap-8 border border-mn-red bg-mn-red px-20 text-13 font-bold text-white hover:text-white'
                    : 'inline-flex h-40 items-center gap-8 border border-control bg-white px-20 text-13 font-bold text-ink'
                }
              >
                <span>{oferta.loja}</span>
                {oferta.preco ? <span className="font-semibold">{oferta.preco}</span> : null}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(abre a loja em nova aba; link de afiliado)</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** FloatRelated (kit docs/02): a 220px box floating right inside the text. */
export function FloatRelated({ chamada }: { chamada: Chamada }) {
  return (
    <aside
      aria-label="Relacionado"
      className="mb-20 box-border flex w-full flex-col gap-10 border border-line p-14 desk:float-right desk:mb-16 desk:ml-28 desk:w-220"
    >
      <span className="text-13 font-extrabold tracking-[-0.02em]">Relacionado</span>
      {chamada.imagem ? (
        <Link
          href={chamada.href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-video overflow-hidden bg-media"
        >
          <Photo imagem={chamada.imagem} uso="related" decorativa />
        </Link>
      ) : null}
      <Link href={chamada.href} className="text-12 leading-[1.35] font-bold">
        {chamada.titulo} ↗
      </Link>
    </aside>
  );
}

/** "Leia também:" — a bold lead-in and one underlined link. */
export function LeiaTambem({ chamada, className }: { chamada: Chamada; className?: string }) {
  return (
    <p className={`m-0 flex flex-wrap items-baseline gap-8 text-13 ${className ?? ''}`}>
      <strong className="font-extrabold">Leia também:</strong>
      <Link href={chamada.href} className="font-semibold underline underline-offset-3">
        {chamada.titulo} ↗
      </Link>
    </p>
  );
}

/**
 * AffiliateNotice (kit docs/02): commission at no extra cost, and that prices hold at the
 * time of publication. The prototype's second sentence speaks of "this prototype"; the
 * production sentence says what is true on the site.
 */
export function AffiliateNotice() {
  return (
    <>
      <p className="m-0 text-12 leading-[1.6] text-note">
        *Comprando pelos links acima, o Máquina Nerd pode receber uma comissão, sem custo adicional para você. Ofertas
        podem estar disponíveis em uma ou mais lojas parceiras.
      </p>
      <p className="mt-8 mb-0 text-12 leading-[1.6] text-note">
        Os preços e ofertas mencionados valem no momento da publicação e podem mudar sem aviso.
      </p>
    </>
  );
}

/**
 * SponsoredGrid (kit docs/02 and 05): four 16/9 cards under "Conteúdo patrocinado", each
 * with its partner line and a "Saiba mais" chip, beside a sticky 300×600. Renders nothing
 * without real items — an empty frame would be an ad for nobody.
 */
export function SponsoredGrid({ itens }: { itens: Patrocinado[] }) {
  if (itens.length === 0) return null;
  return (
    <section aria-label="Conteúdo patrocinado" className="mt-48 border-t border-line pt-32">
      <div className="grid grid-cols-1 items-start gap-40 desk:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="mb-16 flex items-center justify-between">
            <span className="text-12 font-bold text-ink-3">Conteúdo patrocinado</span>
            <span className="text-10 text-muted">Publicidade</span>
          </div>
          <div className="grid grid-cols-2 gap-16 tab:gap-20">
            {itens.map((item) => (
              <a
                key={item.id}
                href={item.href}
                rel="sponsored nofollow noopener noreferrer"
                target="_blank"
                className="flex min-w-0 flex-col gap-8"
              >
                <span className="relative block aspect-video overflow-hidden bg-media">
                  <Photo imagem={item.imagem} uso="card" decorativa />
                </span>
                <span className="text-14 leading-[1.3] font-bold tracking-[-0.01em]">{item.titulo}</span>
                <span className="flex items-center justify-between text-10 text-muted">
                  <span>{item.parceiro}</span>
                  <span className="border border-control px-10 py-3 font-bold text-ink">Saiba mais</span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <AdSlot formato="300x600" ordem={3} sticky />
      </div>
    </section>
  );
}
