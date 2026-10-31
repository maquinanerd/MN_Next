import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Feed } from "@/components/sections/Feed";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getFeed } from "@/lib/content";

type Props = { params: Promise<{ n: string }> };

function parsePagina(n: string): number | null {
  const pagina = Number(n);
  // Só a forma canônica: /page/02 não é uma segunda URL da página 2.
  return /^[1-9]\d*$/.test(n) && pagina >= 2 ? pagina : null;
}

export async function generateStaticParams() {
  const { totalPaginas } = await getFeed(1);
  // Cache Components exige ao menos um parâmetro; sem segunda página, /page/2 responde 404.
  return Array.from({ length: Math.max(1, totalPaginas - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params;
  return {
    title: `Mais do Máquina Nerd — página ${n}`,
    alternates: { canonical: `/page/${n}` },
  };
}

/** Páginas 2+ da lista "Mais do Máquina Nerd" da home. */
export default async function HomePaginada({ params }: Props) {
  const { n } = await params;
  const pagina = parsePagina(n);
  if (!pagina) notFound();
  const feed = await getFeed(pagina);
  if (pagina > feed.totalPaginas) notFound();
  const path = `/page/${pagina}`;
  return (
    <>
      <SiteHeader active="noticias" />
      <main id="conteudo" className="mn-wrap pt-8 pb-16 mob:pt-5">
        <div className="mb-2">
          <SectionTitle as="h1" forte="MAIS" leve={`DO MÁQUINA NERD · PÁGINA ${pagina}`} className="mb-2" />
        </div>
        <Feed
          itens={feed.itens}
          agora={feed.agora}
          pagina={pagina}
          totalPaginas={feed.totalPaginas}
          base="/"
          inline="home-feed-inline"
          sticky="home-feed-sticky"
          ctx={{ path }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
