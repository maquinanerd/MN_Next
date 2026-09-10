import {
  AffiliateNotice,
  ArticleBody,
  ArticleLabel,
  ArticleTitleRow,
  AuthorRail,
  AuthorRow,
  Disclosure,
  EditoriaBand,
  EndNotes,
  FloatRelated,
  FullBleedCover,
  Lead,
  LeiaTambem,
  NextStory,
  RelatedGrid,
  ShareRow,
  SponsoredGrid,
  WideFigure,
} from '@mn/ui';
import { SOCIAL_LINKS } from '@mn/content';

import type { MateriaView } from '../lib/content';
import { Header } from './Chrome';

const facebook = SOCIAL_LINKS.find((s) => s.network === 'facebook')?.href ?? '/';
const x = SOCIAL_LINKS.find((s) => s.network === 'x')?.href ?? '/';

function PreviewNotice() {
  return (
    <div role="note" className="bg-mn-red-text text-white">
      <div className="wrap flex min-h-36 flex-wrap items-center gap-x-12 py-8 text-12">
        <strong className="font-bold">Pré-visualização.</strong>
        <span>Versão não publicada. Esta página não é indexada.</span>
        {/* A POST, not a link: a prefetched link to this route would end the session. */}
        <form method="post" action="/api/preview/disable">
          <button
            type="submit"
            className="cursor-pointer border-0 bg-transparent p-0 text-12 text-white underline underline-offset-3"
          >
            Sair da pré-visualização
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * The three article compositions (kit docs/03), one per `layout`:
 *
 *  - `padrao` (Máquina Nerd Notícias.dc.html): author rail · text · nothing at the right;
 *    the text column aligned to the header menu.
 *  - `overlay` (… Notícias Overlay.dc.html): the cover first, full width, with the header
 *    on it; a 760px column below with the byline row.
 *  - `oferta` (… Notícias Publi.dc.html): no rail; "Leia também" at the top, the product
 *    box, the floating related box, red section headings, the affiliate notice and the
 *    sponsored grid.
 *
 * Links in the text hover in the editoria's text colour, as the prototypes do.
 */
export function ArticleView({ view, preview = false }: { view: MateriaView; preview?: boolean }) {
  const { materia, nav } = view;
  const ativo = view.editoria?.nome;
  const hover = { '--mn-hover': materia.editoria.corTexto } as React.CSSProperties;

  if (materia.layout === 'overlay') {
    return (
      <>
        {preview ? <PreviewNotice /> : null}
        <FullBleedCover materia={materia} header={<Header ativo={ativo} tema="over-image" />} />
        <main style={hover}>
          <div className="wrap pt-20 tab:pt-40">
            <div className="mx-auto max-w-760">
              <article>
                <AuthorRow materia={materia} share className="pb-24" />
                {materia.divulgacao ? <Disclosure divulgacao={materia.divulgacao} className="mb-8" /> : null}
                <Lead>{materia.lead}</Lead>
                <ArticleBody blocos={materia.blocos} cor={materia.editoria.cor} comercial={materia.comercial} />
                <EndNotes facebook={facebook} x={x} newsletter="/newsletter">
                  <ShareRow titulo={materia.titulo} url={materia.url} />
                </EndNotes>
              </article>
              {materia.proxima ? <NextStory chamada={materia.proxima} /> : null}
              <RelatedGrid itens={materia.relacionadas} />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (materia.layout === 'oferta') {
    const [first, ...rest] = materia.blocos;
    const leia = materia.leiaTambem ?? [];
    return (
      <>
        {preview ? <PreviewNotice /> : null}
        <Header ativo={ativo} />
        <main id="conteudo" style={{ '--mn-hover': 'var(--color-mn-red-text)' } as React.CSSProperties}>
          <div className="wrap pt-20 tab:pt-40">
            <div className="mn-col-offer">
              <article>
                <ArticleLabel materia={materia} color="var(--color-mn-red-text)" />
                <ArticleTitleRow materia={materia} />
                <AuthorRow materia={materia} por size={40} className="mt-20 pb-20" />
                {materia.divulgacao ? <Disclosure divulgacao={materia.divulgacao} /> : null}
                {leia[0] ? <LeiaTambem chamada={leia[0]} className="mt-24" /> : null}
                <Lead>{materia.lead}</Lead>
                <div className="mt-32 flow-root">
                  {view.flutuante ? <FloatRelated chamada={view.flutuante} /> : null}
                  {first ? <ArticleBody blocos={[first]} cor={materia.editoria.cor} comercial /> : null}
                </div>
                <ArticleBody blocos={rest} cor={materia.editoria.cor} comercial />
                <div className="mt-40 border-t border-line pt-32">
                  {materia.afiliados ? <AffiliateNotice /> : null}
                  {leia[1] ? <LeiaTambem chamada={leia[1]} className="mt-20" /> : null}
                  <ShareRow titulo={materia.titulo} url={materia.url} />
                </div>
              </article>
              <SponsoredGrid itens={view.patrocinados} />
              <RelatedGrid itens={materia.relacionadas} />
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {preview ? <PreviewNotice /> : null}
      <Header ativo={ativo} />
      <EditoriaBand materia={materia} nav={nav} />
      <main id="conteudo" style={hover}>
        <div className="wrap grid grid-cols-1 pt-20 tab:pt-32 desk:grid-cols-[200px_minmax(0,1fr)]">
          <AuthorRail materia={materia} nav={nav} />
          <div className="min-w-0 desk:border-l desk:border-line desk:pl-68">
            <div className="mn-col">
              <article>
                <ArticleLabel materia={materia} />
                <ArticleTitleRow materia={materia} />
                {/* The rail carries the byline from 901px up; below that it would vanish. */}
                <AuthorRow materia={materia} size={40} className="mt-20 pb-20 desk:hidden" />
                {materia.divulgacao ? <Disclosure divulgacao={materia.divulgacao} className="mt-16" /> : null}
                {materia.imagem ? <WideFigure imagem={materia.imagem} capa priority className="mt-24" /> : null}
                <Lead>{materia.lead}</Lead>
                <ArticleBody blocos={materia.blocos} cor={materia.editoria.cor} comercial={materia.comercial} />
                <EndNotes facebook={facebook} x={x} newsletter="/newsletter">
                  <ShareRow titulo={materia.titulo} url={materia.url} />
                </EndNotes>
              </article>
              {materia.proxima ? <NextStory chamada={materia.proxima} /> : null}
              <RelatedGrid itens={materia.relacionadas} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
