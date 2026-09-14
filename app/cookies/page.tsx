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

/** Lists what the code actually sets — `components/ConsentGate.tsx` and `lib/preview.ts`. */
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

      <h2>Dependem do seu consentimento</h2>
      <p>
        Medição de audiência, publicidade personalizada e conteúdos de terceiros (como vídeos do YouTube) só são
        carregados depois que você aceita. Vídeos incorporados, além disso, só carregam quando você clica neles.
      </p>

      <h2>Como mudar a sua escolha</h2>
      <p>
        Apague os cookies do Máquina Nerd no seu navegador e o aviso de privacidade volta a aparecer. Os detalhes estão
        na <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
    </InstitutionalPage>
  );
}
