import Link from 'next/link';
import type { Metadata } from 'next';
import { Editorial } from '@mn/ui';

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: true },
};

/**
 * 404.
 *
 * `follow` without `index`: the page itself should not be indexed, but a crawler that
 * lands here should still follow the desk links out, so the archive stays reachable from
 * a stale inbound link.
 */
export default function NotFound() {
  return (
    <Editorial>
      <div style={{ paddingBlock: 80, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '68ch' }}>
        <p className="mn-sectionheading__label">Erro 404</p>
        <h1 className="mn-cathead__title">Essa página não existe mais</h1>
        <p className="mn-cathead__desc">
          O endereço pode ter mudado, ou a matéria pode ter sido removida. As editorias abaixo continuam no mesmo lugar.
        </p>
        <nav aria-label="Editorias" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="mn-tag" href="/filmes">
            Filmes
          </Link>
          <Link className="mn-tag" href="/series">
            Séries
          </Link>
          <Link className="mn-tag" href="/quadrinhos">
            Quadrinhos
          </Link>
          <Link className="mn-tag" href="/games">
            Games
          </Link>
          <Link className="mn-tag" href="/animes">
            Animes
          </Link>
        </nav>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="mn-button mn-button--primary" href="/">
            Ir para a home
          </Link>
          <Link className="mn-button" href="/busca">
            Buscar no site
          </Link>
        </div>
      </div>
    </Editorial>
  );
}
