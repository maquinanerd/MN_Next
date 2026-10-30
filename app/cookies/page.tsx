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
 * what the ad library may set for every reader (`components/Adsense.tsx`), and what Google
 * Analytics sets after an accept (`lib/analytics.ts`).
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
        Os anúncios do Google AdSense aparecem para todos os leitores. Sem o seu aceite eles não são personalizados, mas
        o Google ainda pode gravar cookies próprios (como <code>__gads</code> e <code>__gpi</code>) para limitar a
        repetição de um anúncio, medir a entrega de forma agregada e combater fraude. Com o aceite, os anúncios também
        podem ser personalizados.
      </p>

      <h2>Dependem do seu consentimento</h2>
      <p>
        Medição de audiência e publicidade personalizada só começam depois que você aceita. Vídeos incorporados (como os
        do YouTube) só carregam quando você clica neles.
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
