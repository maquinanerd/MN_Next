import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As condições de uso do Máquina Nerd.",
  alternates: { canonical: "/termos-de-uso" },
};

/** Descreve como o site funciona; o texto final é do jurídico do operador (pendência externa). */
export default function TermosPage() {
  return (
    <InstitutionalPage titulo="Termos de uso">
      <h2>Conteúdo</h2>
      <p>
        As matérias, fotos e vídeos publicados no Máquina Nerd pertencem aos seus autores e titulares. Você pode
        compartilhar o link de qualquer matéria; a reprodução do texto ou das imagens depende de autorização.
      </p>
      <h2>Links externos e ofertas</h2>
      <p>
        O Máquina Nerd não se responsabiliza pelo conteúdo de sites externos. Links de compra levam a lojas parceiras,
        cujas condições valem a partir dali — veja a <Link href="/politica-de-afiliados">política de afiliados</Link>.
      </p>
      <h2>Dados pessoais</h2>
      <p>
        O tratamento de dados segue a <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
      <h2>Contato</h2>
      <p>
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
      </p>
    </InstitutionalPage>
  );
}
