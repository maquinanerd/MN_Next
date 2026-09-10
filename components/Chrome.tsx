import { SiteFooter, SiteHeader } from '@mn/ui';

import { LOGO, NAV, footerProps } from '../lib/content/editorias';

/**
 * The site chrome bound to its config, so a page only says what differs: which editoria
 * is active, and whether the header sits on a photograph.
 *
 * The header is rendered by each page rather than by the root layout because the overlay
 * article draws it *inside* its cover; the layout cannot know that.
 */
export function Header({ ativo, tema = 'light' }: { ativo?: string; tema?: 'light' | 'over-image' }) {
  return <SiteHeader nav={NAV} ativo={ativo} tema={tema} inicioHref="/" buscaHref="/busca" logo={LOGO} />;
}

export function Footer({ ativo }: { ativo?: string }) {
  return <SiteFooter {...footerProps(ativo)} />;
}
