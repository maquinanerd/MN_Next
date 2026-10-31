import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Chamada, Imagem, Materia } from "@/lib/content/types";
import { ON_COLOR } from "@/lib/content/editorias";
import { mesAno } from "@/lib/format/date";
import { OverlayCard } from "@/components/cards/OverlayCard";
import { Foto } from "@/components/ui/Foto";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ShareButtons } from "./ShareButtons";

/** Rótulo "Editoria · Assunto", h1 e botões de compartilhar (que descem no mobile). */
export function ArticleHeader({
  materia,
  path,
  cor,
  rotulo = materia.assunto ? `${materia.editoria.nome} · ${materia.assunto}` : materia.editoria.nome,
}: {
  materia: Materia;
  path: string;
  cor?: string;
  rotulo?: string;
}) {
  return (
    <>
      <span
        className="text-[13px] font-bold tracking-[-.01em]"
        style={{ color: cor ?? materia.editoria.corTexto }}
      >
        {rotulo}
      </span>
      <div className="mt-6 flex items-start gap-6 mob:flex-col mob:items-start mob:gap-4">
        <h1 className="m-0 flex-1 text-[28px] leading-[1.12] font-extrabold tracking-[-.035em] mob:text-[25px]">
          {materia.titulo}
        </h1>
        <div className="mt-1.5 mob:mt-0">
          <ShareButtons path={path} titulo={materia.titulo} />
        </div>
      </div>
    </>
  );
}

/** Linha fina: 19px/500 (17px no mobile). */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mn-lead m-0 mt-6 text-[19px] leading-[1.4] font-medium tracking-[-.01em] mob:text-[17px]">
      {children}
    </p>
  );
}

/**
 * Figura que extravasa a coluna de texto em 72px de cada lado (até 1240px), com crédito em
 * 10px itálico alinhado à coluna.
 */
export function WideFigure({
  imagem,
  proporcao = "640/340",
  pb = false,
  eager = false,
  className = "mt-7",
  sizes = "(max-width: 900px) 100vw, 940px",
}: {
  imagem: Imagem;
  proporcao?: string;
  pb?: boolean;
  eager?: boolean;
  className?: string;
  sizes?: string;
}) {
  const legenda = [imagem.legenda, imagem.credito].filter(Boolean).join(" ");
  return (
    <figure className={`mn-wide ${className}`}>
      <div className="relative overflow-hidden rounded-mn bg-mn-media" style={{ aspectRatio: proporcao }}>
        <Image
          src={imagem.url}
          alt={imagem.alt}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className="object-cover"
          style={pb ? { filter: "grayscale(1)" } : undefined}
        />
      </div>
      {legenda && (
        <figcaption className="mt-2 max-w-[420px] text-[10px] text-mn-muted italic">{legenda}</figcaption>
      )}
    </figure>
  );
}

/** "Mais como este": três títulos + foto de 280px 3/2, entre filetes. */
export function RelatedInline({
  itens,
  imagem,
  maisHref,
  maisRotulo,
}: {
  itens: Chamada[];
  imagem?: Imagem;
  maisHref?: string;
  maisRotulo?: string;
}) {
  if (!itens.length) return null;
  const primeiro = itens[0]!;
  return (
    <aside aria-labelledby="mais-como-este" className="my-10 border-y border-mn-line py-7">
      <SectionTitle id="mais-como-este" forte="MAIS" leve="COMO ESTE" tamanho="mais" className="!mb-[18px]" />
      <div className="flex items-center gap-10 mob:flex-col mob:items-stretch mob:gap-6">
        <ul className="m-0 flex flex-1 list-none flex-col gap-3.5 p-0 text-[15px] leading-[1.35] font-semibold tracking-[-.01em]">
          {itens.map((c) => (
            <li key={c.id}>
              <Link href={c.href}>{c.titulo}</Link>
            </li>
          ))}
          {maisHref && (
            <li className="mt-2">
              <Link
                href={maisHref}
                className="w-max text-xs font-normal text-mn-ink-3 underline decoration-[#DDD] underline-offset-3"
              >
                {maisRotulo}
              </Link>
            </li>
          )}
        </ul>
        {imagem && (
          <Link
            href={primeiro.href}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[3/2] w-[280px] flex-none overflow-hidden rounded-mn bg-mn-media mob:w-full"
          >
            <Foto imagem={imagem} sizes="(max-width: 760px) 100vw, 280px" />
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Citação com filete de 3px na cor da editoria. */
export function Citacao({ texto, autor, cor }: { texto: string; autor?: string; cor: string }) {
  return (
    <blockquote className="m-0 mb-7 border-l-[3px] pl-[18px]" style={{ borderColor: cor }}>
      <p className="m-0 max-w-[460px] text-[19px] leading-[1.35] font-bold tracking-[-.02em]">
        {texto}
        {autor && <> – {autor}</>}
      </p>
    </blockquote>
  );
}

/** Aviso final: nota da matéria, convite a comentar, newsletter e compartilhar. */
export function ArticleEnd({ materia, path }: { materia: Materia; path: string }) {
  return (
    <div className="mt-10 border-t border-mn-line pt-8 text-xs leading-[1.6] text-[#444]">
      {materia.notaFinal && <p className="m-0 italic">{materia.notaFinal}</p>}
      <p className={materia.notaFinal ? "mt-3.5 mb-0" : "m-0"}>
        Se quiser comentar esta reportagem ou qualquer outra coisa que viu no Máquina Nerd, vá até a nossa
        página no{" "}
        <a href="https://www.facebook.com/maquinanerd" rel="noopener" className="mn-inline-link">
          Facebook
        </a>{" "}
        ou mande uma mensagem no{" "}
        <a href="https://x.com/maquinanerd" rel="noopener" className="mn-inline-link">
          X
        </a>
        .
      </p>
      <p className="mt-2.5 mb-0">
        E se gostou desta história,{" "}
        <Link href="/newsletter" className="mn-inline-link">
          inscreva-se na newsletter semanal do Máquina Nerd
        </Link>
        . Uma seleção de reportagens de Cinema, Séries e TV, Games e Quadrinhos, entregue na sua caixa de
        entrada.
      </p>
      <div className="mt-6">
        <ShareButtons path={path} titulo={materia.titulo} comNativo />
      </div>
    </div>
  );
}

/** Próxima leitura: selo da editoria, data, título leve, resumo e foto 296/200. */
export function NextStory({ chamada }: { chamada: Chamada }) {
  const on = ON_COLOR[chamada.editoria.textoSobreCor];
  return (
    <aside aria-label="Próxima leitura" className="mt-12 border-t border-mn-line pt-10">
      <div className="grid grid-cols-[minmax(0,1fr)_296px] items-start gap-10 mob:grid-cols-1">
        <div className="flex max-w-[300px] flex-col gap-3.5 mob:max-w-none">
          <div className="flex items-center gap-3.5">
            <span
              className="px-3.5 py-[3px] text-[11px]"
              style={{ background: chamada.editoria.cor, color: on }}
            >
              {chamada.editoria.nome}
            </span>
            <span className="text-[11px] text-mn-muted">{mesAno(chamada.publicadoEm)}</span>
          </div>
          <h2 className="m-0 mt-2 text-lg leading-[1.25] font-normal">
            <Link href={chamada.href}>{chamada.titulo}</Link>
          </h2>
          {chamada.resumo && <p className="m-0 text-xs leading-normal text-mn-summary">{chamada.resumo}</p>}
          <Link
            href={chamada.href}
            className="mt-2.5 w-max text-[11px] text-mn-muted underline decoration-[#DDD] underline-offset-3"
            aria-label={`Ler a notícia: ${chamada.titulo}`}
          >
            Ler a notícia
          </Link>
        </div>
        <Link
          href={chamada.href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[296/200] overflow-hidden rounded-mn bg-mn-media"
        >
          <Foto imagem={chamada.imagem} sizes="(max-width: 760px) 100vw, 296px" />
        </Link>
      </div>
    </aside>
  );
}

/** "Notícias relacionadas": seis overlays em três colunas. */
export function RelatedGrid({ itens, agora }: { itens: Chamada[]; agora: string }) {
  if (!itens.length) return null;
  return (
    <section aria-labelledby="relacionadas" className="mt-12 border-t border-mn-line pt-10 pb-14">
      <SectionTitle
        id="relacionadas"
        forte="NOTÍCIAS"
        leve="RELACIONADAS"
        tamanho="materia"
        className="!mb-6"
      />
      <div className="grid grid-cols-3 gap-6 mob:grid-cols-1 mob:gap-3.5">
        {itens.map((c) => (
          <OverlayCard
            key={c.id}
            chamada={c}
            agora={agora}
            meta="autor"
            sizes="(max-width: 760px) 100vw, 33vw"
          />
        ))}
      </div>
    </section>
  );
}
