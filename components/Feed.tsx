import {
  OpaPrecoAd,
  Pagination,
  RowCard,
  SectionTitle,
  cx,
  opaPrecoEnabled,
  type Chamada,
  type Paginacao,
} from '@mn/ui';

import { porQuem, rotulo } from './meta';

/**
 * The long list at the foot of the home and of every editoria: RowCards at the left, the
 * sticky OpaPreço `sidebar` slot at the right, numbered pagination under the list (kit
 * docs/03).
 *
 * The right column exists from 1024px, OpaPreço's desktop: below that the `sidebar` slot
 * asks for no ad, so the column would only be a hole, and the list takes the width.
 */
export function FeedSection({
  titulo,
  itens,
  paginacao,
  hrefPara,
  cor,
  textoSobreCor,
  now,
  tituloMb = 'mb-28',
  as = 'h2',
  vazio,
}: {
  titulo: { forte: string; fraco?: string };
  itens: Chamada[];
  paginacao: Paginacao;
  hrefPara: (page: number) => string;
  cor?: string;
  textoSobreCor?: 'light' | 'dark';
  now: Date;
  tituloMb?: 'mb-28' | 'mb-8';
  as?: 'h1' | 'h2';
  vazio?: React.ReactNode;
}) {
  const TitleTag = as === 'h1' ? 'h1' : 'h2';
  const lateral = opaPrecoEnabled();
  return (
    <section aria-labelledby="lista-titulo" className="mt-36 border-t border-line pt-48 pb-64 tab:mt-56">
      {TitleTag === 'h1' ? (
        <h1
          id="lista-titulo"
          className={`m-0 text-20 leading-[1.1] font-extrabold tracking-[-0.02em] uppercase tab:text-26 ${tituloMb}`}
        >
          {titulo.forte}
          {titulo.fraco ? <span className="font-light"> {titulo.fraco}</span> : null}
        </h1>
      ) : (
        <SectionTitle id="lista-titulo" forte={titulo.forte} fraco={titulo.fraco} className={tituloMb} />
      )}
      <div className={cx('grid grid-cols-1 items-start gap-40', lateral && 'min-[1024px]:grid-cols-4')}>
        <div className={cx(lateral && 'min-[1024px]:col-span-3')}>
          {itens.length === 0 && vazio ? vazio : null}
          {itens.map((c) => (
            <RowCard key={c.id} chamada={c} kicker={rotulo(c)} meta={porQuem(c, now)} />
          ))}
          <Pagination
            paginacao={paginacao}
            hrefPara={hrefPara}
            {...(cor ? { cor } : {})}
            {...(textoSobreCor ? { textoSobreCor } : {})}
          />
        </div>
        {lateral ? (
          <div className="hidden min-[1024px]:sticky min-[1024px]:top-24 min-[1024px]:block">
            <OpaPrecoAd slot="sidebar" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
