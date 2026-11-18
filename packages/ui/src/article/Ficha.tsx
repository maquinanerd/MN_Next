import type { FichaObra as FichaObraModel } from '../model';
import { Photo } from '../primitives/Photo';
import { VideoFacade } from './VideoFacade';

/**
 * FichaCinerie: the film or series the article is about, as Cinerie describes it — poster,
 * title, the line of facts, genres, synopsis, direction and cast, the trailer behind the
 * click-to-load facade, and where to watch it in Brazil, after the article text.
 *
 * Not one of the seven approved surfaces: it is a module inside the article, built from
 * the tokens only (the product box's frame, `line` borders, the type scale), neutral
 * grey — the editoria's colour stays the text's. The poster reserves its 2:3 box, so the
 * ficha never shifts the page; a missing poster takes no space at all. Every outbound
 * link opens Cinerie or the streaming service in a new tab and says so.
 *
 * The trailer is left out when the text already embeds the same video.
 */
export function FichaCinerie({ ficha, id }: { ficha: FichaObraModel; id: string }) {
  const headingId = `${id}-titulo`;
  const rotulo = ficha.tipo === 'filme' ? 'Ficha do filme' : 'Ficha da série';
  return (
    <section aria-labelledby={headingId} className="mt-40 border border-line">
      <div className="flex items-center justify-between gap-12 border-b border-line px-20 py-12">
        <span className="text-10 font-bold tracking-[0.04em] text-ink-3 uppercase">{rotulo}</span>
        {/* Same tab, with the referrer: Cinerie belongs to the same newsroom group. */}
        <a href={ficha.url} className="text-12 font-bold text-mn-red-text underline decoration-1 underline-offset-3">
          Ver na Cinerie<span className="sr-only">: {ficha.titulo}</span> <span aria-hidden="true">→</span>
        </a>
      </div>

      <div
        className={
          ficha.poster
            ? 'grid grid-cols-[96px_minmax(0,1fr)] gap-16 p-20 tab:grid-cols-[140px_minmax(0,1fr)] tab:gap-24'
            : 'p-20'
        }
      >
        {ficha.poster ? (
          <span className="relative block aspect-[2/3] w-full self-start overflow-hidden rounded-mn bg-product">
            <Photo imagem={ficha.poster} uso="poster" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-8">
          <p className="m-0 text-11 font-bold tracking-[0.04em] text-ink-3 uppercase">{ficha.linhaFina}</p>
          <h2 id={headingId} className="m-0 text-20 leading-[1.2] font-extrabold tracking-[-0.02em]">
            {ficha.titulo}
          </h2>
          {ficha.tituloOriginal ? (
            <p className="m-0 text-12 text-byline">
              Título original: <span lang="und">{ficha.tituloOriginal}</span>
            </p>
          ) : null}
          {ficha.generos.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-6 p-0" aria-label="Gêneros">
              {ficha.generos.map((genero) => (
                <li key={genero} className="border border-control px-8 py-3 text-11 font-semibold text-ink-2">
                  {genero}
                </li>
              ))}
            </ul>
          ) : null}
          {ficha.sinopse ? (
            <p className="m-0 hidden text-14 leading-[1.6] text-ink-2 tab:block">{ficha.sinopse}</p>
          ) : null}
        </div>
      </div>

      {ficha.sinopse ? (
        <p className="m-0 px-20 pb-16 text-14 leading-[1.6] text-ink-2 tab:hidden">{ficha.sinopse}</p>
      ) : null}

      {ficha.direcao.length > 0 || ficha.elenco.length > 0 ? (
        <dl className="m-0 grid grid-cols-1 gap-12 border-t border-line px-20 py-16 tab:grid-cols-[120px_minmax(0,1fr)]">
          {ficha.direcao.length > 0 ? (
            <>
              <dt className="text-11 font-bold tracking-[0.04em] text-ink-3 uppercase">Direção</dt>
              <dd className="m-0 text-13 text-ink-2">{ficha.direcao.join(', ')}</dd>
            </>
          ) : null}
          {ficha.elenco.length > 0 ? (
            <>
              <dt className="text-11 font-bold tracking-[0.04em] text-ink-3 uppercase">Elenco</dt>
              <dd className="m-0 text-13 leading-[1.6] text-ink-2">
                {ficha.elenco.map((pessoa, i) => (
                  <span key={`${pessoa.nome}-${i}`}>
                    {i > 0 ? ', ' : null}
                    {pessoa.nome}
                    {pessoa.personagem ? <span className="text-byline"> ({pessoa.personagem})</span> : null}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {ficha.trailer ? (
        <div className="border-t border-line px-20 py-16">
          <VideoFacade provedor="youtube" id={ficha.trailer.id} titulo={ficha.trailer.titulo} />
        </div>
      ) : null}

      {ficha.ondeAssistir.length > 0 ? (
        <div className="border-t border-line px-20 py-16">
          <h3 className="m-0 text-11 font-bold tracking-[0.04em] text-ink-3 uppercase">Onde assistir no Brasil</h3>
          <dl className="mt-10 mb-0 grid grid-cols-1 gap-8 tab:grid-cols-[120px_minmax(0,1fr)]">
            {ficha.ondeAssistir.map((grupo) => (
              <div key={grupo.modalidade} className="contents">
                <dt className="text-12 font-semibold text-byline">{grupo.modalidade}</dt>
                <dd className="m-0 flex flex-wrap gap-6">
                  {grupo.plataformas.map((plataforma) =>
                    plataforma.url ? (
                      <a
                        key={plataforma.nome}
                        href={plataforma.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex h-32 items-center gap-6 border border-control bg-white px-12 text-12 font-bold text-ink"
                      >
                        {plataforma.nome}
                        <span aria-hidden="true">↗</span>
                        <span className="sr-only">(abre em nova aba)</span>
                      </a>
                    ) : (
                      <span
                        key={plataforma.nome}
                        className="inline-flex h-32 items-center border border-control px-12 text-12 font-bold text-ink-2"
                      >
                        {plataforma.nome}
                      </span>
                    ),
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <p className="m-0 border-t border-line px-20 py-10 text-11 leading-[1.5] text-muted">
        Dados: Cinerie{ficha.poster ? ' · Imagem: TMDB' : ''}
        {ficha.creditoOfertas ? ` · ${ficha.creditoOfertas}` : ''}
      </p>
    </section>
  );
}
