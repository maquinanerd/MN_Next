import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Anuncie",
  description: "Como funcionam os anúncios do Máquina Nerd e as regras que valem para todos eles.",
  alternates: { canonical: "/anuncie" },
};

export default function AnunciePage() {
  return (
    <InstitutionalPage titulo="Anuncie no Máquina Nerd" intro="Formatos, posições e as regras que valem para todo anúncio.">
      <h2>Ofertas do OpaPreço</h2>
      <p>
        A publicidade nas páginas do Máquina Nerd é feita pelo OpaPreço Ads: blocos de ofertas afiliadas com preço
        verificado. Não há banners de rede de anúncios.
      </p>
      <ul>
        <li>Faixas de quatro ofertas depois das seções da home e da abertura de cada editoria.</li>
        <li>Um card de oferta a cada três notícias nas listas e, a partir de 1024px, dois cards fixos na lateral.</li>
        <li>
          Nas matérias: uma oferta em destaque depois da linha fina, uma recomendação ligada ao assunto depois do segundo
          parágrafo, ofertas sempre entre dois parágrafos e uma faixa antes das notícias relacionadas.
        </li>
      </ul>
      <p>
        Todo espaço é reservado antes de a oferta carregar, então nada empurra o texto que o leitor está lendo. Quando não
        há oferta para a posição, o espaço some, sem caixa vazia.
      </p>
      <h2>O que não fazemos</h2>
      <ul>
        <li>Intersticial sobre o conteúdo, incluindo pop-up de newsletter.</li>
        <li>Anúncio entre o título e a linha fina, ou logo depois de uma imagem.</li>
        <li>
          Preço, desconto ou estoque sem dado real: desconto só com preço de referência comprovado e de pelo menos 5%, e
          oferta verificada há mais de 6 horas não aparece.
        </li>
        <li>Contagem regressiva, “últimas unidades”, “só hoje” ou botão piscando para pressionar a compra.</li>
      </ul>
      <h2>Conteúdo patrocinado</h2>
      <p>
        Conteúdo de parceiros aparece sempre sob o rótulo “Conteúdo patrocinado”, com “Parceiro · Patrocinado” em cada
        item, e não é escrito pela redação. Links de compra seguem a{" "}
        <Link href="/politica-de-afiliados">política de afiliados</Link>.
      </p>
      <h2>Contato comercial</h2>
      <p>
        Propostas: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
