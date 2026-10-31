import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { NewsletterForm } from "@/components/layout/NewsletterForm";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Receba a newsletter do Máquina Nerd no seu e-mail.",
  alternates: { canonical: "/newsletter" },
};

/** Não promete frequência nem pauta: provedor e formato editorial ainda não foram decididos. */
export default function NewsletterPage() {
  return (
    <InstitutionalPage
      titulo="Newsletter"
      intro="Receba no seu e-mail uma seleção de notícias de cinema, séries e TV, games, quadrinhos e animes do Máquina Nerd."
    >
      <div className="mb-5 border border-mn-line p-7 mob:p-5">
        <NewsletterForm />
      </div>
      <p className="text-[13px]">
        Usaremos seu e-mail apenas para enviar a newsletter, com link de cancelamento em toda edição. Detalhes
        na <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
    </InstitutionalPage>
  );
}
