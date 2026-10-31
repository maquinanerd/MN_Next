import type { Metadata } from "next";
import { BigCard } from "@/components/cards/BigCard";
import { StackCard } from "@/components/cards/StackCard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OpaSlot } from "@/components/opapreco/OpaSlot";
import { Abertura } from "@/components/sections/Abertura";
import { Feed } from "@/components/sections/Feed";
import { Section } from "@/components/sections/Section";
import { VideoRail } from "@/components/sections/VideoRail";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getFeed, getHome } from "@/lib/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: SITE.name, description: SITE.description },
};

const CTX = { path: "/" };
const RED_TEXT = "#B00710";

/** Grade OpaPreço de seção: 48px abaixo da seção, gap e colunas da grade de notícias. */
function GridSlot({ id }: { id: Parameters<typeof OpaSlot>[0]["id"] }) {
  return <OpaSlot id={id} ctx={CTX} gap="var(--mn-grid-gap)" alinharAoSite className="mt-12" />;
}

export default async function Home() {
  const [home, feed] = await Promise.all([getHome(), getFeed(1)]);
  const { agora } = home;
  const [big1, big2] = home.cinema.grandes;
  return (
    <>
      <SiteHeader active="noticias" />
      <main id="conteudo" className="mn-wrap pt-10 mob:pt-5">
        <h1 className="sr-only">Máquina Nerd: notícias de cinema, séries e TV, games, quadrinhos e animes</h1>

        {/* 1. Abertura: manchete + três overlays + lateral com chamadas e card OpaPreço (games). */}
        <Abertura
          dados={home.abertura}
          agora={agora}
          eager
          slot={<OpaSlot id="home-abertura-side" ctx={CTX} orientacao="narrow" />}
        />

        {/* 2. Notícias de cinema: dois cards com resumo + destaque grande, duas vezes. */}
        <Section labelledBy="secao-cinema">
          <SectionTitle id="secao-cinema" forte="NOTÍCIAS" leve="DE CINEMA" />
          <div className="grid grid-cols-4 gap-10 mob:grid-cols-1">
            {home.cinema.cards.slice(0, 2).map((c) => (
              <StackCard key={c.id} chamada={c} agora={agora} rotulo="assunto" corRotulo={RED_TEXT} sizes="(max-width: 760px) 100vw, 25vw" />
            ))}
            {big1 && <BigCard chamada={big1} agora={agora} className="col-span-2 mob:col-auto" />}
            {home.cinema.cards.slice(2, 4).map((c) => (
              <StackCard key={c.id} chamada={c} agora={agora} rotulo="assunto" corRotulo={RED_TEXT} sizes="(max-width: 760px) 100vw, 25vw" />
            ))}
            {big2 && <BigCard chamada={big2} agora={agora} rotulo="assunto" className="col-span-2 mob:col-auto" />}
          </div>
        </Section>
        <GridSlot id="home-grid-cinema" />

        {/* 3. Games: fileira de quatro (rola na horizontal no mobile). */}
        <Section labelledBy="secao-games">
          <SectionTitle id="secao-games" forte="GAMES" acao={{ href: "/games", label: "Ver Games" }} />
          <div className="mn-scroll-row grid grid-cols-4 gap-10 mob:flex mob:gap-3 mob:overflow-x-auto mob:*:flex-[0_0_62%]">
            {home.games.map((c) => (
              <StackCard key={c.id} chamada={c} agora={agora} rotulo={false} resumo={false} play />
            ))}
          </div>
        </Section>
        <GridSlot id="home-grid-games" />

        {/* 4. Escolha da redação (Séries e TV) com a lateral "Últimas de Quadrinhos". */}
        <Section labelledBy="secao-series">
          <SectionTitle id="secao-series" forte="NOTÍCIAS" leve="DE SÉRIES E TV" />
          <Abertura
            dados={{ manchete: home.series.manchete, destaques: home.series.destaques, lateral: home.quadrinhos }}
            agora={agora}
            rotuloLateral="assunto"
            lateralLabel="Últimas de Quadrinhos"
            lateralTitulo={
              <h3 className="m-0 mb-1.5 text-xl leading-[1.15] font-bold tracking-[-.02em]">
                Últimas de
                <br />
                Quadrinhos:
              </h3>
            }
            slot={<OpaSlot id="home-escolha-side" ctx={CTX} orientacao="narrow" />}
          />
        </Section>
        <GridSlot id="home-grid-series" />

        {/* 5. Animes | Especiais. */}
        <Section labelledBy="secao-animes">
          <SectionTitle id="secao-animes" forte="ANIMES" leve="| ESPECIAIS" acao={{ href: "/especiais", label: "Ver Especiais" }} />
          <div className="mn-scroll-row grid grid-cols-3 gap-10 mob:flex mob:gap-3 mob:overflow-x-auto mob:*:flex-[0_0_62%]">
            {home.animes.map((c) => (
              <StackCard key={c.id} chamada={c} agora={agora} rotulo="completo" sizes="(max-width: 760px) 62vw, 33vw" />
            ))}
          </div>
        </Section>
        <GridSlot id="home-grid-animes" />

        {/* 6. Vídeo em destaque (o bloco "Especiais" do mapa de slots). */}
        <Section labelledBy="secao-videos">
          <SectionTitle id="secao-videos" forte="VÍDEO" leve="EM DESTAQUE" />
          <BigCard chamada={home.videos.destaque} agora={agora} rotulo="completo" video />
          <VideoRail
            abas={[
              { id: "recomendados", label: "Recomendados", itens: home.videos.recomendados },
              { id: "mais-vistos", label: "Mais vistos", itens: home.videos.maisVistos ?? [] },
              { id: "recentes", label: "Recentes", itens: home.videos.recentes },
            ]}
          />
        </Section>
        <GridSlot id="home-grid-hq" />

        {/* 7. Mais do Máquina Nerd: lista com card a cada 3 itens, paginação e 2 cards fixos. */}
        <Section labelledBy="secao-mais" className="pb-16">
          <SectionTitle id="secao-mais" forte="MAIS" leve="DO MÁQUINA NERD" />
          <Feed
            itens={feed.itens}
            agora={feed.agora}
            pagina={1}
            totalPaginas={feed.totalPaginas}
            base="/"
            inline="home-feed-inline"
            sticky="home-feed-sticky"
            ctx={CTX}
          />
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
