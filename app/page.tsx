import type { Metadata } from 'next';
import {
  AdSlot,
  BigCard,
  FeatureVideoCard,
  HeroCard,
  OverlayCard,
  SectionTitle,
  SideList,
  StandardCard,
  VideoCard,
} from '@mn/ui';
import { JsonLd, buildGraph, collectionNode } from '@mn/seo';

import { Header } from '../components/Chrome';
import { FeedSection } from '../components/Feed';
import { Opening } from '../components/Opening';
import { data, rotulo, rotuloComposto, tempo } from '../components/meta';
import { EDITORIAS, agora, homeView } from '../lib/content';
import { seoContext } from '../lib/seo-context';

/**
 * Home (Máquina Nerd Template.dc.html), in the prototype's order.
 *
 * ISR at 60 seconds plus `revalidateTag('home')` on publication: the tag makes a new
 * story appear at once, the window bounds staleness if a webhook is ever lost.
 */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const ctx = seoContext();
  return {
    title: { absolute: 'Máquina Nerd — cinema, séries, games, quadrinhos e animes' },
    alternates: { canonical: `${ctx.siteUrl}/` },
  };
}

const section = 'mt-36 border-t border-line pt-48 tab:mt-56';
const scroller =
  'no-scrollbar flex gap-12 overflow-x-auto *:flex-[0_0_62%] tab:grid tab:gap-40 tab:overflow-visible tab:*:flex-auto';

export default async function HomePage() {
  const ctx = seoContext();
  const now = agora();
  const home = await homeView();

  const graph = buildGraph(ctx, [
    collectionNode(ctx, {
      name: 'Máquina Nerd',
      description: 'Notícias de cinema, séries, games, quadrinhos e animes.',
      url: `${ctx.siteUrl}/`,
      items: home.itens,
    }),
  ]);

  const [c0, c1, c2, c3, c4, c5] = home.cinema;

  return (
    <>
      <JsonLd graph={graph} />
      <Header ativo="Notícias" />
      <main id="conteudo" className="wrap pt-20 tab:pt-40">
        <h1 className="sr-only">Máquina Nerd — notícias de cinema, séries, games, quadrinhos e animes</h1>

        <Opening {...home.abertura} now={now} modo="home" ordemAnuncio={1} />

        {home.cinema.length > 0 ? (
          <section aria-labelledby="h-cinema" className={section}>
            <SectionTitle id="h-cinema" forte="Notícias" fraco="de cinema" className="mb-28" />
            <div className="grid grid-cols-1 gap-14 tab:grid-cols-4 tab:gap-40">
              {c0 ? <StandardCard chamada={c0} kicker={rotulo(c0)} meta={tempo(c0, now)} /> : null}
              {c1 ? <StandardCard chamada={c1} kicker={rotulo(c1)} meta={tempo(c1, now)} /> : null}
              {c2 ? <BigCard chamada={c2} kicker={rotulo(c2)} meta={tempo(c2, now)} /> : null}
              {c3 ? <StandardCard chamada={c3} kicker={rotulo(c3)} meta={tempo(c3, now)} /> : null}
              {c4 ? <StandardCard chamada={c4} kicker={rotulo(c4)} meta={tempo(c4, now)} /> : null}
              {c5 ? <BigCard chamada={c5} kicker={rotulo(c5)} meta={tempo(c5, now)} /> : null}
            </div>
          </section>
        ) : null}

        {home.games.length > 0 ? (
          <section aria-labelledby="h-games" className={section}>
            <SectionTitle
              id="h-games"
              forte="Games"
              acao={{ rotulo: 'Ver Games', href: EDITORIAS.games.href }}
              className="mb-28"
            />
            <div className={`${scroller} tab:grid-cols-4`}>
              {home.games.map((c) => (
                <StandardCard key={c.id} chamada={c} meta={tempo(c, now)} showExcerpt={false} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Publicidade" className="mt-36 border-t border-line pt-32 tab:mt-56">
          <AdSlot formato="970x250" />
        </section>

        {home.series.manchete ? (
          <section aria-labelledby="h-series" className={section}>
            <SectionTitle id="h-series" forte="Notícias" fraco="de Séries e TV" className="mb-28" />
            <div className="grid grid-cols-1 items-start gap-14 tab:grid-cols-4 tab:gap-40">
              <div className="flex flex-col gap-14 tab:col-span-3 tab:gap-24">
                <HeroCard
                  chamada={home.series.manchete}
                  kicker={home.series.manchete.editoria.nome}
                  meta={data(home.series.manchete)}
                  variante="pick"
                  as="h3"
                />
                <div className="grid grid-cols-1 gap-14 tab:grid-cols-3 tab:gap-24">
                  {home.series.destaques.map((c) => (
                    <OverlayCard key={c.id} chamada={c} kicker={c.editoria.nome} meta={tempo(c, now)} />
                  ))}
                </div>
              </div>
              {home.quadrinhos.length > 0 ? (
                <SideList
                  titulo={['Últimas de', `${EDITORIAS.quadrinhos.nome}:`]}
                  itens={home.quadrinhos}
                  kicker={rotulo}
                  meta={(c) => tempo(c, now)}
                  ordemAnuncio={2}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {home.animes.length > 0 ? (
          <section aria-labelledby="h-animes" className={section}>
            <SectionTitle
              id="h-animes"
              forte="Animes"
              fraco="| Especiais"
              acao={{ rotulo: 'Ver Animes', href: EDITORIAS.animes.href }}
              className="mb-28"
            />
            <div className={`${scroller} tab:grid-cols-3`}>
              {home.animes.map((c) => (
                <StandardCard key={c.id} chamada={c} kicker={rotuloComposto(c)} meta={data(c)} />
              ))}
            </div>
          </section>
        ) : null}

        {home.videos.destaque ? (
          <section aria-labelledby="h-videos" className={section}>
            <SectionTitle id="h-videos" forte="Vídeo" fraco="em destaque" className="mb-28" />
            <FeatureVideoCard chamada={home.videos.destaque} kicker={rotuloComposto(home.videos.destaque)} />
            {home.videos.clipes.length > 0 ? (
              <>
                <div className="mt-16 flex items-center border-b border-line">
                  <span
                    className="-mb-px border-b-2 py-10 text-12"
                    style={{ color: EDITORIAS.videos.corTexto, borderColor: EDITORIAS.videos.cor }}
                  >
                    Recentes
                  </span>
                </div>
                <div className={`${scroller} mt-28 tab:grid-cols-4`}>
                  {home.videos.clipes.map((c) => (
                    <VideoCard key={c.id} chamada={c} kicker={rotulo(c)} />
                  ))}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <FeedSection
          titulo={{ forte: 'Mais', fraco: 'do Máquina Nerd' }}
          itens={home.feed}
          paginacao={home.paginacao}
          hrefPara={(n) => (n === 1 ? '/' : `/page/${n}`)}
          now={now}
          anunciosACada3
          primeiraOrdem={3}
        />
      </main>
    </>
  );
}
