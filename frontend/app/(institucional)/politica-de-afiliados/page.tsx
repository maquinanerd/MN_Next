import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de afiliados",
  description: "Como funcionam os links de afiliados e as ofertas do OpaPreço no Máquina Nerd.",
  alternates: { canonical: "/politica-de-afiliados" },
};

export default function AfiliadosPage() {
  return (
    <InstitutionalPage titulo="Política de afiliados">
      <p>
        Algumas páginas do Máquina Nerd contêm links de afiliados. Quando uma compra é feita por esses links,
        o Máquina Nerd pode receber uma comissão da loja, sem nenhum custo adicional para você.
      </p>
      <h2>Como identificamos</h2>
      <ul>
        <li>
          Matérias de oferta ficam em <Link href="/ofertas">/ofertas</Link> e trazem o aviso de afiliados no
          fim do texto.
        </li>
        <li>
          Cada caixa de produto traz o rótulo “Oferta · link de afiliado” e o nome da loja em cada botão.
        </li>
        <li>
          Os blocos do OpaPreço mostram, sempre à vista, o selo “Link de afiliado”, “Oferta afiliada” ou
          “Links de afiliado”, a loja e há quanto tempo o preço foi verificado.
        </li>
        <li>
          Todo link de compra é marcado como patrocinado para os mecanismos de busca (
          <code>rel=&quot;sponsored&quot;</code>).
        </li>
      </ul>
      <h2>Preços</h2>
      <p>
        Preços e ofertas valem no momento da verificação e podem mudar sem aviso. Desconto só aparece com
        preço de referência comprovado e de pelo menos 5%; queda de preço, só quando registrada. Oferta
        verificada há mais de 6 horas não é exibida, e uma oferta que expira enquanto a página está aberta
        passa a aparecer como indisponível.
      </p>
      <h2>Independência</h2>
      <p>
        A comissão não decide o que a redação recomenda nem a ordem em que os produtos aparecem nas matérias.
      </p>
      <p>
        Dúvidas: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
