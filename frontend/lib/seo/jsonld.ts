import type { Materia } from "@/lib/content/types";
import { absoluteUrl, SITE } from "@/lib/site";

/** Dados estruturados (schema.org) em JSON-LD. */

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo-on-light.png"), width: 267, height: 65 },
    sameAs: [SITE.social.facebook, SITE.social.instagram, SITE.social.x],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    inLanguage: "pt-BR",
    publisher: { "@id": `${SITE.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/busca?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(itens: { nome: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.nome,
      item: absoluteUrl(it.path),
    })),
  };
}

export function newsArticleLd(m: Materia, path: string) {
  const texto = m.lead.map((t) => t.texto).join("");
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
    headline: m.titulo,
    description: m.resumo ?? texto,
    image: m.imagem ? [absoluteUrl(m.imagem.url)] : undefined,
    datePublished: m.publicadoEm,
    dateModified: m.atualizadoEm ?? m.publicadoEm,
    author: (m.autores ?? []).map((a) => ({ "@type": "Person", name: a.nome })),
    publisher: { "@id": `${SITE.url}/#organization` },
    articleSection: m.editoria.nome,
    keywords: m.tags?.join(", "),
    inLanguage: "pt-BR",
  };
}

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * `<script type="application/ld+json">` seguro: `<`, `>` e `&` viram escapes Unicode, então
 * um título vindo do CMS com `</script>` não fecha a tag; U+2028/U+2029 também.
 */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c] ?? c) };
}
