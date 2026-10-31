import type { Metadata } from "next";
import { InstitutionalPage } from "@/components/layout/Institutional";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description: "O compromisso de acessibilidade do Máquina Nerd e como relatar um problema.",
  alternates: { canonical: "/acessibilidade" },
};

export default function AcessibilidadePage() {
  return (
    <InstitutionalPage titulo="Acessibilidade" intro="O Máquina Nerd segue as diretrizes WCAG 2.1, nível AA.">
      <h2>O que o site faz</h2>
      <ul>
        <li>Todo texto tem contraste mínimo de 4,5:1 com o fundo.</li>
        <li>Todas as páginas podem ser navegadas pelo teclado, com o foco sempre visível.</li>
        <li>O link “Ir para o conteúdo”, no início de cada página, pula o menu.</li>
        <li>Imagens informativas têm descrição; imagens decorativas são ignoradas pelos leitores de tela.</li>
        <li>
          Cada oferta é um único link, com o produto, o preço, a loja e o aviso de afiliado no nome lido em
          voz alta.
        </li>
        <li>Quem pede menos movimento ao sistema não vê as animações do menu nem das ofertas.</li>
      </ul>
      <h2>Encontrou um problema?</h2>
      <p>
        Escreva para <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> com o endereço da página
        e o que aconteceu. Toda mensagem sobre acessibilidade é respondida.
      </p>
    </InstitutionalPage>
  );
}
