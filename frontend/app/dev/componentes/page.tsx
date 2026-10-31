import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BigCard } from "@/components/cards/BigCard";
import { OverlayCard } from "@/components/cards/OverlayCard";
import { RowCard } from "@/components/cards/RowCard";
import { StackCard } from "@/components/cards/StackCard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Abertura } from "@/components/sections/Abertura";
import { EditoriaLabel } from "@/components/ui/EditoriaLabel";
import { Meta } from "@/components/ui/Meta";
import { Pagination } from "@/components/ui/Pagination";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getFeed, getHome } from "@/lib/content";

export const metadata: Metadata = {
  title: "Componentes editoriais",
  robots: { index: false, follow: false },
};

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t border-mn-line pt-12">
      <p className="m-0 mb-6 font-mono text-xs text-mn-muted">{titulo}</p>
      {children}
    </section>
  );
}

export default async function ComponentesPage() {
  const home = await getHome();
  const feed = await getFeed(1);
  const { agora } = home;
  const [a, b, c] = home.abertura.destaques;
  return (
    <>
      <SiteHeader />
      <main className="mn-wrap pt-10 pb-16">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-.035em]">Componentes editoriais</h1>
        <p className="mt-2 mb-0 text-[13px] text-mn-summary">
          Primitivos da Etapa 2 com dados de demonstração. Rota interna, fora do índice.
        </p>

        <Bloco titulo="EditoriaLabel · Meta">
          <div className="flex flex-wrap items-center gap-6">
            {[home.abertura.manchete, a, b, c, ...home.games.slice(0, 1), ...home.animes.slice(0, 1)].map(
              (x) => x && <EditoriaLabel key={x.id} chamada={x} modo="completo" />,
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-mn-muted">
            <Meta chamada={home.abertura.manchete} agora={agora} />
            <Meta chamada={home.abertura.manchete} agora={agora} modo="tempo-editoria" />
            <Meta chamada={home.abertura.manchete} agora={agora} modo="autor-tempo" />
          </div>
        </Bloco>

        <Bloco titulo="SectionTitle">
          <SectionTitle forte="NOTÍCIAS" leve="DE CINEMA" />
          <SectionTitle forte="GAMES" acao={{ href: "/games", label: "Ver Games" }} />
          <SectionTitle forte="MAIS" leve="COMO ESTE" tamanho="mais" />
        </Bloco>

        <Bloco titulo="Abertura: HeroCard · OverlayCard × 3 · FitSidebar (sem slot nesta etapa)">
          <Abertura dados={home.abertura} agora={agora} />
        </Bloco>

        <Bloco titulo="StackCard · BigCard">
          <div className="grid grid-cols-4 gap-10 mob:grid-cols-1">
            {home.cinema.cards.slice(0, 2).map((x) => (
              <StackCard key={x.id} chamada={x} agora={agora} rotulo="assunto" corRotulo="#B00710" />
            ))}
            <BigCard chamada={home.cinema.grandes[0]!} agora={agora} className="col-span-2 mob:col-auto" />
          </div>
        </Bloco>

        <Bloco titulo="OverlayCard (relacionadas)">
          <div className="grid grid-cols-3 gap-6 mob:grid-cols-1">
            {home.abertura.destaques.map((x) => (
              <OverlayCard key={x.id} chamada={x} agora={agora} meta="autor" />
            ))}
          </div>
        </Bloco>

        <Bloco titulo="RowCard · Pagination">
          <div className="max-w-[1000px]">
            {feed.itens.slice(0, 3).map((x) => (
              <RowCard key={x.id} chamada={x} agora={agora} />
            ))}
            <Pagination atual={1} total={24} base="/dev/componentes" />
            <Pagination atual={12} total={24} base="/dev/componentes" cor="#A248FC" textoSobreCor="dark" />
            <Pagination atual={3} total={3} base="/dev/componentes" cor="#1E1E1E" />
          </div>
        </Bloco>
      </main>
      <SiteFooter />
    </>
  );
}
