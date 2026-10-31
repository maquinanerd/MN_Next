import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEditoria as getEditoriaData } from "./index";
import { assuntoBySlug, EDITORIA_SLUGS, getEditoria, slugify } from "./editorias";

/** Rotas de editoria: validação dos parâmetros, dados e metadata compartilhados. */

export function parsePagina(n: string | undefined): number | null {
  if (n === undefined) return 1;
  return /^\d+$/.test(n) && Number(n) >= 2 ? Number(n) : null;
}

export async function loadEditoria(slug: string, n?: string, assuntoSlug?: string) {
  const editoria = getEditoria(slug);
  const pagina = parsePagina(n);
  if (!editoria || !pagina) notFound();
  let assunto: string | undefined;
  if (assuntoSlug !== undefined) {
    assunto = assuntoBySlug(editoria, assuntoSlug);
    if (!assunto) notFound();
  }
  const data = await getEditoriaData(editoria.slug, pagina, assunto);
  if (!data || pagina > data.feed.totalPaginas) notFound();
  return data;
}

export function editoriaMetadata(slug: string, n?: string, assuntoSlug?: string): Metadata {
  const editoria = getEditoria(slug);
  if (!editoria) return {};
  const assunto = assuntoSlug ? assuntoBySlug(editoria, assuntoSlug) : undefined;
  const base = assuntoSlug ? `/${slug}/assunto/${assuntoSlug}` : `/${slug}`;
  const path = n ? `${base}/page/${n}` : base;
  const nome = assunto ? `${assunto} em ${editoria.nome}` : editoria.nome;
  return {
    title: n ? `${nome} — página ${n}` : nome,
    description: `Notícias, críticas e reportagens de ${nome.toLowerCase()} no Máquina Nerd.`,
    alternates: { canonical: path },
    openGraph: { url: path, title: nome },
  };
}

export const editoriaParams = () => EDITORIA_SLUGS.map((editoria) => ({ editoria }));

export function assuntoParams() {
  return EDITORIA_SLUGS.flatMap((slug) =>
    (getEditoria(slug)?.assuntos.slice(1) ?? []).map((a) => ({ editoria: slug, assunto: slugify(a) })),
  );
}
