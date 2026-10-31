import type { Metadata } from "next";
import { RowCard } from "@/components/cards/RowCard";
import { AffiliateNotice } from "@/components/commerce/Commerce";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { getOfertasLista } from "@/lib/content";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Matérias de ofertas do Máquina Nerd, com links de afiliado identificados.",
  alternates: { canonical: "/ofertas" },
};

/** Índice das matérias de oferta (destino do "Ofertas" na trilha de navegação). */
export default async function OfertasPage() {
  const { itens, agora } = await getOfertasLista();
  return (
    <InstitutionalPage titulo="Ofertas" intro="Matérias de ofertas com links de afiliado, sempre identificados.">
      <div className="max-w-[1000px] text-sm">
        {itens.length ? (
          itens.map((c) => <RowCard key={c.id} chamada={c} agora={agora} rotulo="assunto" />)
        ) : (
          <p>Nenhuma oferta publicada no momento.</p>
        )}
      </div>
      <div className="mt-10">
        <AffiliateNotice />
      </div>
    </InstitutionalPage>
  );
}
