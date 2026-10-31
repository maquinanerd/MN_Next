import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { EDITORIA_SLUGS, EDITORIAS } from "@/lib/content/editorias";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mais",
  description: "Todas as editorias, ofertas e páginas do Máquina Nerd.",
  alternates: { canonical: "/mais" },
};

/** Destino do item "Mais" da nav: o mapa do site. */
export default function MaisPage() {
  return (
    <InstitutionalPage titulo="Mais do Máquina Nerd" active="mais">
      <h2>Editorias</h2>
      <ul>
        <li>
          <Link href="/">Notícias</Link>
        </li>
        {EDITORIA_SLUGS.map((s) => (
          <li key={s}>
            <Link href={`/${s}`}>{EDITORIAS[s].nome}</Link>
          </li>
        ))}
        <li>
          <Link href="/ofertas">Ofertas</Link>
        </li>
      </ul>
      <h2>O Máquina Nerd</h2>
      <ul>
        <li>
          <Link href="/sobre">Sobre o Máquina Nerd</Link>
        </li>
        <li>
          <Link href="/newsletter">Newsletter</Link>
        </li>
        <li>
          <Link href="/anuncie">Anuncie</Link>
        </li>
        <li>
          <a href={`mailto:${SITE.contactEmail}`}>Fale com a redação</a>
        </li>
        <li>
          <a href={SITE.cinerie} rel="noopener">
            Cinerie, o site irmão
          </a>
        </li>
      </ul>
      <h2>Políticas</h2>
      <ul>
        <li>
          <Link href="/politica-de-afiliados">Política de afiliados</Link>
        </li>
        <li>
          <Link href="/politica-de-privacidade">Política de privacidade</Link>
        </li>
        <li>
          <Link href="/cookies">Cookies</Link>
        </li>
        <li>
          <Link href="/termos-de-uso">Termos de uso</Link>
        </li>
        <li>
          <Link href="/acessibilidade">Acessibilidade</Link>
        </li>
      </ul>
    </InstitutionalPage>
  );
}
