'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { currentSection } from '../lib/section';
import type { FooterLink } from './SiteFooter';

/**
 * "Explore o Máquina Nerd": the editoria links, with the reader's section in its own text
 * colour, as every prototype draws it. The footer lives in the root layout, which does not
 * know the route, so the one part of it that depends on the route is decided here.
 *
 * `aria-current="page"` only on the link to this very page; the section of an article or
 * a paginated list is `aria-current="true"`.
 */
export function FooterExplore({ links }: { links: FooterLink[] }) {
  const pathname = usePathname() ?? '/';
  const secao = currentSection(pathname);
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-20 gap-y-14 p-0 text-12 desk:col-span-3 desk:grid-cols-6 desk:gap-y-16">
      {links.map((link) => {
        if (link.externo) {
          return (
            <li key={link.href} className="leading-[1.4] desk:leading-[1.35]">
              <a href={link.href} rel="noopener">
                {link.rotulo}
              </a>
            </li>
          );
        }
        const pagina = link.href === pathname;
        const ativo = pagina || link.href === secao;
        return (
          <li key={link.href} className="leading-[1.4] desk:leading-[1.35]">
            <Link
              href={link.href}
              style={ativo ? { color: link.cor ?? 'var(--color-mn-red-text)' } : undefined}
              aria-current={pagina ? 'page' : ativo ? 'true' : undefined}
            >
              {link.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
