import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { SlotContext } from "@/lib/ads/slots";
import type { Materia } from "@/lib/content/types";
import { ON_COLOR } from "@/lib/content/editorias";
import { breadcrumbLd, newsArticleLd } from "@/lib/seo/jsonld";
import { AffiliateNotice, LeiaTambem, SponsoredGrid } from "@/components/commerce/Commerce";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import { JsonLd } from "@/components/ui/JsonLd";
import { ArticleBody } from "./ArticleBody";
import { ArticleEnd, ArticleHeader, Lead, NextStory, RelatedGrid, WideFigure } from "./ArticleParts";
import { AuthorLine, AuthorRail } from "./AuthorRail";
import { ShareButtons } from "./ShareButtons";
import { Trechos } from "./Trechos";

type M = Materia & { agora: string };

function slotCtx(m: Materia, path: string): SlotContext {
  return { path, editoria: m.editoria.slug, tags: m.tags, layout: m.layout };
}

function Estruturados({ m, path }: { m: Materia; path: string }) {
  const trilha =
    m.layout === "oferta"
      ? [
          { nome: "Máquina Nerd", path: "/" },
          { nome: "Ofertas", path: "/ofertas" },
          { nome: m.titulo, path },
        ]
      : [
          { nome: "Máquina Nerd", path: "/" },
          { nome: m.editoria.nome, path: `/${m.editoria.slug}` },
          { nome: m.titulo, path },
        ];
  return (
    <>
      <JsonLd data={newsArticleLd(m, path)} />
      <JsonLd data={breadcrumbLd(trilha)} />
    </>
  );
}

/** Faixa da editoria no mobile (≤900px), onde a coluna do autor some. */
function EditoriaStrip({ m }: { m: Materia }) {
  return (
    <Link
      href={`/${m.editoria.slug}`}
      className="hidden h-10 items-center justify-between px-4 text-sm le900:flex"
      style={{ background: m.editoria.cor, color: ON_COLOR[m.editoria.textoSobreCor] }}
    >
      <span>{m.editoria.nome}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </Link>
  );
}

/** article-top: hero no desktop/tablet, card no mobile (o hero ocuparia uma tela inteira). */
function TopSlot({ ctx }: { ctx: SlotContext }) {
  return (
    <>
      <OpaSlot id="article-top" ctx={{ ...ctx, viewport: "desktop" }} className="op-only-desktop mt-7" />
      <OpaSlot id="article-top" ctx={{ ...ctx, viewport: "mobile" }} className="op-only-mobile mt-6" orientacao="narrow" />
    </>
  );
}

function Fim({ m, ctx }: { m: M; ctx: SlotContext }) {
  return (
    <>
      {m.proxima && <NextStory chamada={m.proxima} />}
      <OpaSlot id="article-bottom" ctx={ctx} className="mt-12" />
      <RelatedGrid itens={m.relacionadas} agora={m.agora} />
    </>
  );
}

function linkVars(cor: string, extra?: Record<string, string>): CSSProperties {
  return { "--mn-link": cor, "--mn-link-hover": cor, ...extra } as CSSProperties;
}

/** Matéria padrão: coluna do autor · texto alinhado ao menu · nada à direita. */
export function MateriaPadrao({ m, path }: { m: M; path: string }) {
  const ctx = slotCtx(m, path);
  return (
    <>
      <Estruturados m={m} path={path} />
      <SiteHeader active={m.editoria.slug} />
      <EditoriaStrip m={m} />
      <div className="mn-art-shell" style={linkVars(m.editoria.corTexto)}>
        <div className="mn-wrap grid grid-cols-[200px_minmax(0,1fr)] pt-8 le900:grid-cols-1 mob:pt-5">
          <AuthorRail materia={m} />
          <main id="conteudo" className="min-w-0 border-l border-mn-line pl-[68px] le900:border-l-0 le900:pl-0">
            <div className="mn-art-col">
              <article>
                <ArticleHeader materia={m} path={path} />
                <div className="mt-5 hidden le900:block">
                  <AuthorLine materia={m} size={40} prefixo="Por " />
                </div>
                {m.imagem && <WideFigure imagem={m.imagem} proporcao="640/320" eager className="mt-6" />}
                <Lead>
                  <Trechos trechos={m.lead} />
                </Lead>
                <TopSlot ctx={ctx} />
                <ArticleBody blocos={m.blocos} layout={m.layout} ctx={ctx} corCitacao={m.editoria.cor} />
                <ArticleEnd materia={m} path={path} />
              </article>
              <Fim m={m} ctx={ctx} />
            </div>
          </main>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/**
 * Capa em tela cheia: foto em 100% da largura, cabeçalho branco sobre ela (logo e itens
 * claros, sem filete), título e linha fina embaixo, crédito no canto inferior direito.
 */
function FullBleedCover({ m }: { m: Materia }) {
  const leadTexto = m.resumo;
  return (
    <div className="relative flex min-h-svh flex-col bg-[#111] text-white">
      {m.imagem && (
        <Image src={m.imagem.url} alt={m.imagem.alt} fill loading="eager" fetchPriority="high" sizes="100vw" className="object-cover" />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55)_0%,rgba(0,0,0,.25)_22%,rgba(0,0,0,.2)_50%,rgba(0,0,0,.85)_100%)]"
      />
      <SiteHeader active={m.editoria.slug} tema="over-image" />
      <div className="mn-wrap relative z-[2] flex flex-1 flex-col items-start justify-end gap-4 pt-20 pb-14 mob:pt-12 mob:pb-10">
        <div className="flex max-w-[820px] flex-col gap-4">
          <h1 className="m-0 text-[clamp(32px,4.2vw,60px)] leading-[1.04] font-extrabold tracking-[-.035em] mob:text-[26px] mob:leading-[1.1]">
            {m.titulo}
          </h1>
          {leadTexto && (
            <p className="m-0 max-w-[720px] text-[clamp(15px,1.2vw,18px)] leading-normal text-white/92">{leadTexto}</p>
          )}
        </div>
      </div>
      {m.imagem?.credito && (
        <span className="absolute right-3 bottom-2.5 z-[2] text-[10px] text-white/60 italic">{m.imagem.credito}</span>
      )}
    </div>
  );
}

/** Matéria overlay: capa em tela cheia e texto centrado em 760px. */
export function MateriaOverlay({ m, path }: { m: M; path: string }) {
  const ctx = slotCtx(m, path);
  return (
    <>
      <Estruturados m={m} path={path} />
      <FullBleedCover m={m} />
      <div className="mn-art-shell" style={linkVars(m.editoria.corTexto)}>
        <div className="mn-wrap pt-10 mob:pt-6">
          <main id="conteudo" className="mx-auto max-w-[760px] min-w-0">
            <article>
              <div className="flex flex-wrap items-center justify-between gap-6 border-b border-mn-line pb-6">
                <AuthorLine materia={m} size={44} />
                <ShareButtons path={path} titulo={m.titulo} />
              </div>
              <Lead>
                <Trechos trechos={m.lead} />
              </Lead>
              <TopSlot ctx={ctx} />
              <ArticleBody blocos={m.blocos} layout={m.layout} ctx={ctx} corCitacao={m.editoria.cor} />
              <ArticleEnd materia={m} path={path} />
            </article>
            <Fim m={m} ctx={ctx} />
          </main>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/**
 * Matéria de oferta: sem coluna do autor, "Leia também" no topo, card multi-loja próprio,
 * caixa "Relacionado", subtítulos em vermelho, aviso de afiliados e conteúdo patrocinado
 * com o card OpaPreço fixo ao lado.
 */
export function MateriaOferta({ m, path }: { m: M; path: string }) {
  const ctx = slotCtx(m, path);
  const RED = "#B00710";
  return (
    <>
      <Estruturados m={m} path={path} />
      <SiteHeader active={m.editoria.slug} />
      <EditoriaStrip m={m} />
      <div className="mn-art-shell" style={linkVars(RED, { "--mn-col-left": "68px" })}>
        <div className="mn-wrap pt-10 mob:pt-5">
          <main id="conteudo" className="min-w-0">
            <div className="mn-art-col">
              <article>
                <ArticleHeader
                  materia={m}
                  path={path}
                  cor={RED}
                  rotulo={m.assunto ? `${m.assunto} · ${m.editoria.nome}` : m.editoria.nome}
                />
                <div className="mt-5 border-b border-mn-line pb-5">
                  <AuthorLine materia={m} size={40} prefixo="Por " />
                </div>
                {m.leiaTambem?.topo && <LeiaTambem item={m.leiaTambem.topo} className="mt-6" />}
                <div className="[&>p]:mt-5">
                  <Lead>
                    <Trechos trechos={m.lead} />
                  </Lead>
                </div>
                <ArticleBody blocos={m.blocos} layout={m.layout} ctx={ctx} corCitacao={RED} />
                <div className="mt-10 border-t border-mn-line pt-8">
                  <AffiliateNotice />
                  {m.leiaTambem?.fim && <LeiaTambem item={m.leiaTambem.fim} className="mt-5" />}
                  <div className="mt-6">
                    <ShareButtons path={path} titulo={m.titulo} comNativo />
                  </div>
                </div>
              </article>
              {m.patrocinados?.length ? (
                <section aria-label="Conteúdo patrocinado" className="mt-12 border-t border-mn-line pt-8">
                  <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-10 lt1024:grid-cols-1">
                    <SponsoredGrid itens={m.patrocinados} />
                    <div className="sticky top-6 lt1024:hidden">
                      <OpaSlot id="article-sticky" ctx={ctx} orientacao="narrow" />
                    </div>
                  </div>
                </section>
              ) : null}
              <Fim m={m} ctx={ctx} />
            </div>
          </main>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
