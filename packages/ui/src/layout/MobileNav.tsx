'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { NavItem } from '@mn/content';

/**
 * Mobile navigation.
 *
 * A disclosure, not a modal: no focus trap to get wrong, no scroll lock, and the links
 * remain in the document for a screen reader when it is open. The prototypes never
 * designed a mobile menu (audit debt 5), so this is the neutral, accessible default the
 * charter calls for rather than an invented visual direction.
 */
export function MobileNav({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        className="mn-iconbutton mn-header__mobile-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Fechar o menu' : 'Abrir o menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
        </svg>
        {open ? 'Fechar' : 'Menu'}
      </button>

      {open ? (
        <div className="mn-mobilenav" id={panelId}>
          <div className="mn-shell">
            <nav aria-label="Navegação principal (mobile)">
              <ul className="mn-mobilenav__list">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/busca" onClick={() => setOpen(false)}>
                    Buscar
                  </Link>
                </li>
                <li>
                  <Link href="/newsletter" onClick={() => setOpen(false)}>
                    Newsletter
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
