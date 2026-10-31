import type { Metadata } from "next";
import type { Materia } from "./types";

export function materiaMetadata(m: Materia, path: string): Metadata {
  const description = m.resumo ?? m.lead.map((t) => t.texto).join("").slice(0, 160);
  return {
    title: m.titulo,
    description,
    alternates: { canonical: path },
    authors: m.autores?.map((a) => ({ name: a.nome })),
    openGraph: {
      type: "article",
      url: path,
      title: m.titulo,
      description,
      publishedTime: m.publicadoEm,
      modifiedTime: m.atualizadoEm ?? m.publicadoEm,
      section: m.editoria.nome,
      tags: m.tags,
      authors: m.autores?.map((a) => a.nome),
      images: m.imagem ? [{ url: m.imagem.url, alt: m.imagem.alt }] : undefined,
    },
    twitter: { card: "summary_large_image", title: m.titulo, description },
  };
}
