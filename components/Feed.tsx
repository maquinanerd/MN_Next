import { Fragment } from 'react';
import { AdSlot, Pagination, RowCard, SectionTitle, type Chamada, type Paginacao } from '@mn/ui';

import { porQuem, rotulo } from './meta';

/**
 * The long list at the foot of the home and of every editoria: RowCards at the left, a
 * sticky 300×600 at the right, numbered pagination under the list (kit docs/03).
 *
 * `anunciosACada3` is the home's rule — a 728×90 across the column after every third
 * story, with its own rule under it. The editoria list has none (its prototype has none).
 */
export function FeedSection({
  titulo,
  itens,
  paginacao,
  hrefPara,
  cor,
  textoSobreCor,
  now,
  anunciosACada3 = false,
  primeiraOrdem = 1,
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
  anunciosACada3?: boolean;
  /** First ordinal for this section's ad slots, so every slot on the page has a unique name. */
  primeiraOrdem?: number;
  tituloMb?: 'mb-28' | 'mb-8';
  as?: 'h1' | 'h2';
  vazio?: React.ReactNode;
}) {
  const TitleTag = as === 'h1' ? 'h1' : 'h2';
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
      <div className="grid grid-cols-1 items-start gap-40 tab:grid-cols-4">
        <div className="tab:col-span-3">
          {itens.length === 0 && vazio ? vazio : null}
          {itens.map((c, i) => (
            <Fragment key={c.id}>
              <RowCard chamada={c} kicker={rotulo(c)} meta={porQuem(c, now)} />
              {anunciosACada3 && (i + 1) % 3 === 0 && i < itens.length - 1 ? (
                <div className="border-b border-line py-24">
                  <AdSlot formato="728x90" ordem={primeiraOrdem + Math.floor(i / 3)} />
                </div>
              ) : null}
            </Fragment>
          ))}
          <Pagination
            paginacao={paginacao}
            hrefPara={hrefPara}
            {...(cor ? { cor } : {})}
            {...(textoSobreCor ? { textoSobreCor } : {})}
          />
        </div>
        <div className="flex flex-col gap-24 border-t border-line pt-8 tab:sticky tab:top-24 tab:border-t-0 tab:pt-0">
          <AdSlot formato="300x600" />
        </div>
      </div>
    </section>
  );
}
