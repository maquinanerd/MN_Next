import type { MetadataRoute } from "next";
import { getEditoria, listMaterias } from "@/lib/content";
import { EDITORIA_SLUGS, EDITORIAS, slugify } from "@/lib/content/editorias";
import { absoluteUrl } from "@/lib/site";

const INSTITUCIONAL = [
  "/sobre",
  "/newsletter",
  "/anuncie",
  "/politica-de-afiliados",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/cookies",
  "/acessibilidade",
  "/mais",
];

/** Só endereços finais e canônicos: home, editorias, filtros com conteúdo, matérias, ofertas e institucionais. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const materias = await listMaterias();
  const recente = materias.reduce((max, m) => (m.publicadoEm > max ? m.publicadoEm : max), "");
  const filtros = await Promise.all(
    EDITORIA_SLUGS.flatMap((slug) =>
      EDITORIAS[slug].assuntos.slice(1).map(async (assunto) => {
        const data = await getEditoria(slug, 1, assunto);
        return data?.feed.itens.length ? `/${slug}/assunto/${slugify(assunto)}` : null;
      }),
    ),
  );
  return [
    { url: absoluteUrl("/"), lastModified: recente || undefined, changeFrequency: "hourly", priority: 1 },
    ...EDITORIA_SLUGS.map((slug) => ({
      url: absoluteUrl(`/${slug}`),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...filtros.filter((p): p is string => !!p).map((p) => ({ url: absoluteUrl(p), changeFrequency: "daily" as const, priority: 0.5 })),
    { url: absoluteUrl("/ofertas"), changeFrequency: "daily", priority: 0.5 },
    ...materias.map((m) => ({
      url: absoluteUrl(m.layout === "oferta" ? `/ofertas/${m.slug}` : `/${m.editoria}/${m.slug}`),
      lastModified: m.atualizadoEm ?? m.publicadoEm,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...INSTITUCIONAL.map((p) => ({ url: absoluteUrl(p), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
