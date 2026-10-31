import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Quais dados o Máquina Nerd trata, com que finalidade e como exercer seus direitos sob a LGPD.",
  alternates: { canonical: "/politica-de-privacidade" },
};

/** Descreve só o que este front faz. O texto final é do jurídico do operador (pendência externa). */
export default function PrivacidadePage() {
  return (
    <InstitutionalPage
      titulo="Política de privacidade"
      intro="Como o Máquina Nerd trata dados pessoais, conforme a Lei 13.709/2018 (LGPD)."
    >
      <h2>O que o site coleta</h2>
      <p>
        O site não grava cookies próprios nem usa ferramentas de medição de audiência. A busca envia o termo
        pesquisado ao nosso servidor apenas para montar a página de resultados. Mais detalhes em{" "}
        <Link href="/cookies">cookies</Link>.
      </p>
      <h2>Ofertas do OpaPreço</h2>
      <p>
        Quando um bloco de ofertas fica visível na tela, o navegador avisa o OpaPreço para contar a exibição,
        o que envia ao OpaPreço o endereço IP e o tipo de navegador, como em qualquer requisição. Ao clicar em
        uma oferta, você vai para a loja com um identificador de afiliado; a partir dali vale a política de
        privacidade da loja.
      </p>
      <h2>Newsletter</h2>
      <p>
        O e-mail informado será usado apenas para o envio da newsletter, com link de cancelamento em toda
        edição. Enquanto a inscrição estiver em demonstração, nenhum endereço é enviado nem guardado.
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos seus
        dados. Escreva para <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
