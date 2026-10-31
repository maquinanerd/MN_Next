import type { Metadata } from 'next';
import Link from 'next/link';
import { listingMetadata } from '@mn/seo';

import { InstitutionalPage } from '../../components/Institutional';
import { seoContext } from '../../lib/seo-context';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata(seoContext(), {
    title: 'Cookies',
    description: 'Quais cookies o Máquina Nerd usa e para quê.',
    path: '/cookies',
  });
}

/**
 * Lists what the code actually sets — `components/ConsentGate.tsx` and `lib/preview.ts` —
 * that the ads set nothing (`components/OpaPrecoAds.tsx`: OpaPreço's requests go without
 * cookies), and what Google Analytics sets after an accept (`lib/analytics.ts`).
 */
export default function CookiesPage() {
  return (
    <InstitutionalPage titulo="Cookies">
      <h2>Essenciais</h2>
      <ul>
        <li>
          <code>mn-consent</code> — guarda a sua escolha no aviso de privacidade (“Apenas essenciais” ou “Aceitar
          todos”) por seis meses, para o aviso não reaparecer a cada página.
        </li>
        <li>
          Cookies de pré-visualização — usados apenas pela redação ao revisar uma matéria antes de publicar. Um leitor
          nunca os recebe.
        </li>
      </ul>

      <h2>Publicidade</h2>
      <p>
        Os anúncios são ofertas da Shopee escolhidas pelo OpaPreço Ads a partir do assunto da página, iguais para todos
        os leitores. Eles não gravam cookie, e o pedido de anúncio vai sem cookie: leva o endereço e o título da página,
        a editoria, as tags, o número da matéria e o tamanho da tela. Ao clicar numa oferta, você vai direto para a
        Shopee, e dali em diante valem os cookies e a política de privacidade da loja.
      </p>

      <h2>Dependem do seu consentimento</h2>
      <p>
        A medição de audiência só começa depois que você aceita. Vídeos incorporados (como os do YouTube) só carregam
        quando você clica neles.
      </p>
      <ul>
        <li>
          <code>_ga</code> e <code>_ga_&lt;id&gt;</code> — Google Analytics. Guardam um identificador aleatório do
          navegador, para o Google Analytics distinguir visitantes e sessões; os relatórios que vemos são agregados
          (quantas pessoas leram uma matéria, de onde vieram). Duram até dois anos e só são gravados depois do “Aceitar
          todos”.
        </li>
      </ul>

      <h2>Como mudar a sua escolha</h2>
      <p>
        Apague os cookies do Máquina Nerd no seu navegador e o aviso de privacidade volta a aparecer. Os detalhes estão
        na <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
    </InstitutionalPage>
  );
}
