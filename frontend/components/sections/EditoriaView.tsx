import Link from "next/link";
import type { EditoriaData } from "@/lib/content/adapter";
import { ON_COLOR, slugify } from "@/lib/content/editorias";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import { Abertura } from "@/components/sections/Abertura";
import { Feed } from "@/components/sections/Feed";
import { Section } from "@/components/sections/Section";
import { pageHref } from "@/components/ui/Pagination";
import { JsonLd } from "@/components/ui/JsonLd";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { breadcrumbLd } from "@/lib/seo/jsonld";

/**
 * Página de editoria (protótipo Categorias), uma implementação para as sete: cabeçalho
 * com o nome e os filtros de assunto, abertura igual à da home, faixa OpaPreço da própria
 * editoria e "Todas as notícias" com card a cada 3 itens, "Carregar mais", paginação e
 * dois cards fixos na lateral.
 */
export function EditoriaView({ data, assuntoSlug }: { data: EditoriaData; assuntoSlug?: string }) {
  const { editoria, abertura, feed, agora, assunto } = data;
  const raiz = `/${editoria.slug}`;
  const base = assuntoSlug ? `${raiz}/assunto/${assuntoSlug}` : raiz;
  const path = feed.pagina > 1 ? pageHref(base, feed.pagina) : base;
  const ctx = { path, editoria: editoria.slug };
  const on = ON_COLOR[editoria.textoSobreCor];
  const nomeMaiusculo = editoria.nome.toUpperCase();

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { nome: "Máquina Nerd", path: "/" },
          { nome: editoria.nome, path: raiz },
          ...(assunto && assuntoSlug ? [{ nome: assunto, path: `${raiz}/assunto/${assuntoSlug}` }] : []),
        ])}
      />
      <SiteHeader active={editoria.slug} />
      <main id="conteudo" className="mn-wrap pt-8 mob:pt-5">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-6 border-b border-mn-line pb-5">
          <h1 className="m-0 text-[34px] leading-none font-extrabold tracking-[-.03em]" style={{ color: editoria.corTexto }}>
            {editoria.nome}
          </h1>
          <nav aria-label={`Assuntos de ${editoria.nome}`} className="flex flex-wrap gap-1.5">
            {editoria.assuntos.map((a, i) => {
              const slug = i === 0 ? undefined : slugify(a);
              const ativo = slug === assuntoSlug;
              return (
                <Link
                  key={a}
                  href={slug ? `${raiz}/assunto/${slug}` : raiz}
                  aria-current={ativo ? "page" : undefined}
                  className="border px-3.5 py-[7px] text-xs font-semibold"
                  style={
                    ativo
                      ? { background: editoria.cor, borderColor: editoria.cor, color: on }
                      : { borderColor: "#E1E1E1", color: "#111" }
                  }
                >
                  {a}
                </Link>
              );
            })}
          </nav>
        </div>

        {abertura && (
          <>
            <h2 className="sr-only">Destaques de {editoria.nome}</h2>
            <Abertura
              dados={abertura}
              agora={agora}
              rotulo="assunto"
              metaLateral="tempo"
              eager
              slot={<OpaSlot id="editoria-abertura-side" ctx={ctx} orientacao="narrow" />}
            />
            <OpaSlot id="editoria-grid" ctx={ctx} gap="var(--mn-grid-gap)" alinharAoSite className="mt-12" />
          </>
        )}

        <Section labelledBy="todas" className={`pb-16 ${abertura ? "" : "mt-0 border-t-0 pt-2"}`}>
          <SectionTitle
            id="todas"
            forte={assunto ? assunto.toUpperCase() : "TODAS"}
            leve={assunto ? `EM ${nomeMaiusculo}` : `AS NOTÍCIAS DE ${nomeMaiusculo}`}
            className="mb-2"
          />
          <Feed
            itens={feed.itens}
            agora={agora}
            pagina={feed.pagina}
            totalPaginas={feed.totalPaginas}
            base={base}
            cor={editoria.cor}
            textoSobreCor={editoria.textoSobreCor}
            rotulo="assunto"
            inline="editoria-feed-inline"
            sticky="editoria-feed-sticky"
            ctx={ctx}
            antesDaPaginacao={
              feed.pagina === 1 && feed.totalPaginas > 1 ? (
                <div className="mt-10 flex justify-center">
                  <Link href={pageHref(base, 2)} className="border border-mn-line-3 px-10 py-[9px] text-xs text-mn-ink">
                    Carregar mais notícias de {editoria.nome}
                  </Link>
                </div>
              ) : undefined
            }
          />
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
