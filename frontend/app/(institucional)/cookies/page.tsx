import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Quais cookies o Máquina Nerd usa e para quê.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <InstitutionalPage titulo="Cookies">
      <h2>Cookies do Máquina Nerd</h2>
      <p>
        Nenhum. Esta versão do site não grava cookies próprios: não há aviso de consentimento porque não há nada a
        consentir.
      </p>
      <h2>Lojas e parceiros</h2>
      <p>
        Ao clicar em uma oferta ou em um conteúdo patrocinado, você sai do Máquina Nerd; a loja ou o parceiro pode gravar
        os próprios cookies a partir dali, segundo a política de cada um.
      </p>
      <p>
        Os detalhes estão na <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
    </InstitutionalPage>
  );
}
