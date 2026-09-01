import Link from 'next/link';
import type { NavItem } from '@mn/content';

import { Shell, SearchIcon } from '../primitives/misc';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

/**
 * Site header.
 *
 * Nothing in the nav is painted red: active state belongs to `<CategoryTabs />`, which
 * is the one component allowed to signal "you are here" (docs/03). Both logo variants
 * ship in the markup and CSS picks one via `--mn-logo-light` / `--mn-logo-dark`, so the
 * theme switch cannot flash the wrong mark.
 */
export interface SiteHeaderProps {
  nav: NavItem[];
  brand?: 'mn' | 'cinerie';
  /** Optional breaking-news line rendered as the strip above the logo row. */
  breaking?: { label: string; title: string; href: string } | null;
}

export function SiteHeader({ nav, breaking = null }: SiteHeaderProps) {
  return (
    <>
      {breaking ? (
        <div className="mn-breaking">
          <Shell>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="mn-breaking__badge">{breaking.label}</span>
              <Link className="mn-breaking__text" href={breaking.href}>
                {breaking.title}
              </Link>
            </div>
          </Shell>
        </div>
      ) : null}

      <header className="mn-header">
        <Shell>
          <div className="mn-header__inner">
            <Link className="mn-header__logo" href="/" aria-label="Máquina Nerd, página inicial">
              {/* Both marks are in the DOM; CSS shows exactly one per theme. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mn-logo--light"
                src="/brand/mn-logo-on-light.png"
                alt="Máquina Nerd"
                width={168}
                height={30}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mn-logo--dark"
                src="/brand/mn-logo-on-dark.png"
                alt="Máquina Nerd"
                width={168}
                height={30}
              />
            </Link>

            <nav className="mn-header__nav" aria-label="Editorias">
              {nav.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mn-header__actions">
              <Link className="mn-iconbutton" href="/busca" aria-label="Buscar no Máquina Nerd">
                <SearchIcon />
                <span className="mn-header__searchlabel">Buscar</span>
              </Link>
              <ThemeToggle />
              <MobileNav nav={nav} />
            </div>
          </div>
        </Shell>
      </header>
    </>
  );
}
