import Link from 'next/link';
import { FOOTER_COLUMNS, NETWORK_LINKS, SITE, SOCIAL_LINKS, type SocialLink } from '@mn/content';

import { Shell } from '../primitives/misc';

/**
 * Footer.
 *
 * Social marks are inline SVG with a 44px target and a distinct `aria-label` each; the
 * audit replaced the prototype's "f / in / X / yt" text stand-ins with real icons.
 */

function SocialIcon({ network }: { network: SocialLink['network'] }) {
  switch (network) {
    case 'facebook':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4A19 19 0 0 0 14.4 4.3c-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          aria-hidden="true"
        >
          <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'x':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.6 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.5 5.6zM16.5 19.2h1.8L7.6 4.7H5.7z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10.1 14.9V9.1L15.1 12z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SiteFooter() {
  const sibling = NETWORK_LINKS.find((n) => n.brand === 'cinerie');
  const year = 2026;

  return (
    <footer className="mn-footer">
      <Shell>
        <div className="mn-footer__grid">
          <div className="mn-footer__about">
            <div className="mn-footer__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mn-logo--light"
                src="/brand/mn-logo-on-light.png"
                alt="Máquina Nerd"
                width={156}
                height={28}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mn-logo--dark"
                src="/brand/mn-logo-on-dark.png"
                alt="Máquina Nerd"
                width={156}
                height={28}
              />
            </div>
            <p>{SITE.tagline}</p>
            {sibling ? (
              <p className="mn-footer__network">
                <span className="mn-networkbar__dot mn-networkbar__dot--cinerie" aria-hidden="true" />
                <a href={sibling.href} rel="noopener">
                  {sibling.label} · {sibling.description}
                </a>
              </p>
            ) : null}
            <div className="mn-footer__social">
              {SOCIAL_LINKS.map((social) => (
                <a key={social.network} href={social.href} aria-label={social.label} rel="noopener me">
                  <SocialIcon network={social.network} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            // "Editorias" is already the header nav's name; two landmarks may not share one.
            <nav key={column.title} aria-label={`${column.title} (rodapé)`}>
              <h2>{column.title}</h2>
              <ul className="mn-footer__links">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('http') || link.href.startsWith('mailto:') ? (
                      <a href={link.href} rel="noopener">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mn-footer__legal">
          <p>© {year} Máquina Nerd. Todos os direitos reservados.</p>
          <p>
            <Link href="/publicidade#afiliados">Alguns links desta página são de afiliados.</Link>
          </p>
        </div>
      </Shell>
    </footer>
  );
}
