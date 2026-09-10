import type { Metadata } from 'next';
import { SITE } from '@mn/content';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Política de afiliados',
    description: 'Como funcionam os links de afiliados no Máquina Nerd.',
    path: '/politica-de-afiliados',
  });
}

export default function AffiliatePolicyPage() {
  return (
    <InstitutionalPage titulo="Política de afiliados">
      <p>
        Algumas matérias do Máquina Nerd contêm links de afiliados. Quando uma compra é feita por esses links, o Máquina
        Nerd pode receber uma comissão da loja, sem nenhum custo adicional para você.
      </p>

      <h2>Como identificamos</h2>
      <ul>
        <li>Matérias de oferta ficam em /ofertas e trazem o aviso de afiliados no fim do texto.</li>
        <li>Cada caixa de produto traz o rótulo “Oferta · link de afiliado” e o nome da loja em cada botão.</li>
        <li>
          Todo link de compra é marcado como patrocinado para os mecanismos de busca (
          <code>rel=&quot;sponsored nofollow&quot;</code>).
        </li>
      </ul>

      <h2>Preços</h2>
      <p>
        Preços e ofertas valem no momento da publicação e podem mudar sem aviso. Só publicamos preço, desconto e
        disponibilidade quando temos o dado; não criamos urgência com contagem regressiva ou estoque.
      </p>

      <h2>Independência</h2>
      <p>A comissão não decide o que recomendamos nem a ordem em que os produtos aparecem.</p>

      <p>
        Dúvidas: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </InstitutionalPage>
  );
}
