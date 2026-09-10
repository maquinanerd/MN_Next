import Link from 'next/link';

import { AdSlot } from '../ads/AdSlot';
import { LeiaTambem, ProductCard } from '../commercial/Commercial';
import { cx } from '../lib/cx';
import type { Bloco, Trecho } from '../model';
import { Photo } from '../primitives/Photo';
import { RelatedInline, WideFigure } from './Extras';
import { VideoFacade } from './VideoFacade';

/**
 * Inline runs. Every mark is a React element built from typed data — there is no
 * `dangerouslySetInnerHTML` anywhere in an article. Internal links go through `next/link`;
 * on a commercial page an outbound link is `rel="sponsored nofollow"` (docs/05).
 */
export function Inline({ trechos, comercial = false }: { trechos: Trecho[]; comercial?: boolean }) {
  return (
    <>
      {trechos.map((t, i) => {
        if (t.tipo === 'quebra') return <br key={i} />;
        let node: React.ReactNode = t.texto;
        if (t.codigo) node = <code className="text-[0.92em]">{node}</code>;
        if (t.riscado) node = <s>{node}</s>;
        if (t.sublinhado) node = <u>{node}</u>;
        if (t.italico) node = <em>{node}</em>;
        if (t.negrito) node = <strong className="font-bold">{node}</strong>;
        if (t.link) {
          // Underlined as well as coloured: colour alone is 1.4–1.8:1 against the body text,
          // and WCAG 1.4.1 asks for 3:1 or a second cue (docs/migration/DECISIONS.md §7).
          const cls = comercial
            ? 'text-mn-red-text underline underline-offset-3'
            : 'text-(--mn-hover) underline decoration-1 underline-offset-3';
          node = t.link.externo ? (
            <a href={t.link.href} rel={comercial ? 'sponsored nofollow noopener' : 'noopener'} className={cls}>
              {node}
            </a>
          ) : (
            <Link href={t.link.href} className={cls}>
              {node}
            </Link>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

const PARAGRAPH =
  'm-0 text-16 leading-[1.65] text-ink-2 tab:text-17 tab:leading-[1.6] tab:text-justify tab:hyphens-auto';

/** After a wide figure the prototypes open a new section under a rule. */
const SECTION = 'mt-40 border-t border-line pt-32';

type Tipo = Bloco['tipo'];

/** Top spacing for a block, from what precedes it — so margins never stack or vanish. */
function spacing(tipo: Tipo, prev: Tipo | null, afterWide: boolean): string {
  if (afterWide && tipo !== 'imagem') return SECTION;
  if (prev === null) return tipo === 'paragrafo' ? 'mt-32' : 'mt-28';
  switch (tipo) {
    case 'paragrafo':
    case 'lista':
    case 'fonte':
      return prev === 'subtitulo' || prev === 'citacao' || prev === 'anuncio' || prev === 'relacionadas-inline'
        ? 'mt-0'
        : 'mt-[1em]';
    case 'subtitulo':
      return 'mt-36';
    case 'citacao':
      return prev === 'subtitulo' ? 'mt-0' : 'mt-28';
    case 'leia-tambem':
      return 'mt-24';
    default:
      return 'mt-28';
  }
}

/**
 * ArticleBody (kit docs/02): 17px/1.6 paragraphs, justified on desktop and left-aligned
 * at 16px/1.65 on a phone; 22px section headings; the pull quote with a 3px rule in the
 * editoria colour; ads that the adapter has already placed between two paragraphs.
 */
export function ArticleBody({
  blocos,
  cor,
  comercial = false,
}: {
  blocos: Bloco[];
  /** The editoria's full colour: the quote rule. */
  cor: string;
  comercial?: boolean;
}) {
  let prev: Tipo | null = null;
  let afterWide = false;

  return (
    <>
      {blocos.map((b, i) => {
        const top = spacing(b.tipo, prev, afterWide);
        prev = b.tipo;
        afterWide = b.tipo === 'imagem' && b.largura === 'larga';
        const key = `${b.tipo}-${i}`;

        switch (b.tipo) {
          case 'paragrafo':
            return (
              <p key={key} className={cx(PARAGRAPH, top)}>
                <Inline trechos={b.conteudo} comercial={comercial} />
              </p>
            );
          case 'subtitulo': {
            const H = b.nivel === 2 ? 'h2' : b.nivel === 3 ? 'h3' : 'h4';
            return (
              <H
                key={key}
                id={b.id}
                className={cx(
                  'mb-14 leading-[1.2] font-extrabold tracking-[-0.025em]',
                  b.nivel === 2 ? 'text-22' : 'text-18',
                  comercial && 'text-mn-red-text',
                  top,
                )}
              >
                {b.texto}
              </H>
            );
          }
          case 'citacao':
            return (
              <blockquote key={key} className={cx('mx-0 mb-28 border-l-3 pl-18', top)} style={{ borderColor: cor }}>
                <p className="m-0 max-w-460 text-19 leading-[1.35] font-bold tracking-[-0.02em]">
                  <Inline trechos={b.conteudo} comercial={comercial} />
                  {b.autoria ? <> – {b.autoria}</> : null}
                </p>
              </blockquote>
            );
          case 'imagem':
            return b.largura === 'larga' ? (
              <WideFigure key={key} imagem={b.imagem} className={top === SECTION ? 'mt-28' : top} />
            ) : (
              <figure key={key} className={cx('mx-0', top)}>
                <div
                  className="relative overflow-hidden rounded-mn bg-media"
                  style={{
                    aspectRatio:
                      b.imagem.largura && b.imagem.altura ? `${b.imagem.largura} / ${b.imagem.altura}` : '16 / 9',
                  }}
                >
                  <Photo imagem={b.imagem} uso="figure" />
                </div>
                {b.imagem.legenda || b.imagem.credito ? (
                  <figcaption className="mt-8 max-w-420 text-10 text-muted italic">
                    {[b.imagem.legenda, b.imagem.credito ? `(Crédito: ${b.imagem.credito})` : null]
                      .filter(Boolean)
                      .join(' ')}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'galeria':
            return (
              <div key={key} className={cx('grid grid-cols-2 gap-8', top)}>
                {b.imagens.map((img, j) => (
                  <figure key={j} className="relative m-0 aspect-[3/2] overflow-hidden rounded-mn bg-media">
                    <Photo imagem={img} uso="card" />
                  </figure>
                ))}
              </div>
            );
          case 'lista': {
            const L = b.ordenada ? 'ol' : 'ul';
            return (
              <L
                key={key}
                className={cx(
                  'mb-0 pl-20 text-16 leading-[1.6] text-ink-2 tab:text-17',
                  b.ordenada ? 'list-decimal' : 'list-disc',
                  top,
                )}
              >
                {b.itens.map((item, j) => (
                  <li key={j} className="mt-6 first:mt-0">
                    <Inline trechos={item} comercial={comercial} />
                  </li>
                ))}
              </L>
            );
          }
          case 'tabela':
            return (
              <div key={key} className={cx('overflow-x-auto', top)}>
                <table className="w-full border-collapse text-14 leading-[1.5] text-ink-2">
                  {b.cabecalho.length > 0 ? (
                    <thead>
                      <tr>
                        {b.cabecalho.map((h, j) => (
                          <th key={j} scope="col" className="border-b border-ink px-10 py-8 text-left font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {b.linhas.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} className="border-b border-line px-10 py-8 align-top">
                            <Inline trechos={cell} comercial={comercial} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'video':
            return (
              <div key={key} className={top}>
                <VideoFacade provedor={b.provedor} id={b.id} titulo={b.titulo} />
              </div>
            );
          case 'incorporado':
            return (
              <p key={key} className={cx('m-0 border border-line p-20 text-13', top)}>
                Conteúdo publicado no {b.provedor}.{' '}
                <a
                  href={b.url}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="font-semibold underline underline-offset-3"
                >
                  Abrir a publicação ↗
                </a>
              </p>
            );
          case 'fonte':
            return (
              <p key={key} className={cx('m-0 text-13 text-ink-3', top)}>
                Fonte:{' '}
                <a
                  href={b.url}
                  rel={comercial ? 'sponsored nofollow noopener' : 'noopener'}
                  className="underline underline-offset-3"
                >
                  {b.rotulo} ↗
                </a>
              </p>
            );
          case 'relacionadas-inline':
            return <RelatedInline key={key} itens={b.itens} imagem={b.imagem} mais={b.mais} />;
          case 'anuncio':
            return <AdSlot key={key} formato={b.formato} ordem={b.ordem} className="my-32" />;
          case 'produto':
            return <ProductCard key={key} produto={b.produto} />;
          case 'leia-tambem':
            return <LeiaTambem key={key} chamada={b.item} className={top} />;
          default:
            return null;
        }
      })}
    </>
  );
}
