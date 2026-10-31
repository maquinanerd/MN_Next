import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sobre o Máquina Nerd",
  description: "Quem faz o Máquina Nerd, como apuramos e como corrigimos.",
  alternates: { canonical: "/sobre" },
};

export default function SobrePage() {
  return (
    <InstitutionalPage titulo="Sobre o Máquina Nerd">
      <p>
        O Máquina Nerd cobre cultura pop: cinema, séries e TV, games, quadrinhos e animes. Publicamos
        notícias, críticas, reportagens e conteúdo comercial claramente identificado.
      </p>
      <h2>Como apuramos</h2>
      <p>
        Toda matéria indica a origem da informação. Quando a fonte é um comunicado, dizemos que é um
        comunicado. Quando é uma pessoa que pediu para não ser identificada, dizemos isso também. Números de
        audiência e bilheteria trazem o medidor e o período.
      </p>
      <h2>Conteúdo comercial</h2>
      <p>
        Matérias com link de afiliado ficam em <Link href="/ofertas">/ofertas</Link> e trazem aviso de
        afiliados. Os blocos de ofertas do OpaPreço trazem o selo de afiliado à vista e o horário da última
        verificação de preço. As regras estão na{" "}
        <Link href="/politica-de-afiliados">política de afiliados</Link> e em{" "}
        <Link href="/anuncie">anuncie</Link>.
      </p>
      <h2 id="correcoes">Correções</h2>
      <p>
        Erro publicado é erro corrigido no mesmo endereço, e a data de atualização aparece na matéria. Para
        pedir uma correção, escreva para <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> com o
        link e o trecho.
      </p>
      <h2>Rede</h2>
      <p>
        O{" "}
        <a href={SITE.cinerie} rel="noopener">
          Cinerie
        </a>{" "}
        é nosso site irmão, dedicado a cinema e séries.
      </p>
    </InstitutionalPage>
  );
}
