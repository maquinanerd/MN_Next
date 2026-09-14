'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { cx } from '../lib/cx';
import type { NavItem } from '../model';
import { MenuIcon, SearchIcon } from '../primitives/icons';

export interface SiteHeaderProps {
  nav: NavItem[];
  /** `rotulo` of the item to paint as active (the editoria of the page). */
  ativo?: string;
  /** `over-image`: the header sits on the overlay article's cover, logo and items white. */
  tema?: 'light' | 'over-image';
  inicioHref: string;
  buscaHref: string;
  logo: { light: string; dark: string; width: number; height: number };
}

/**
 * SiteHeader, EditoriaNav and MobileDrawer (kit docs/02).
 *
 * Desktop: logo (34px) at the left, the nine editorias centred, search and menu at the
 * right; 64px tall, 1px border below. Each item carries a 4px strip in its editoria colour
 * which grows to fill the item on hover, the label following 80ms later; the active item
 * arrives filled. Below 1181px the items tighten to 12px and the nav scrolls sideways.
 *
 * Mobile (≤760px): a `44px 1fr 44px` grid — menu, centred 28px logo, search — 56px tall.
 * The menu opens a vertical drawer, 48px per item, with a 3px strip and the current item
 * in `--mn-red-text`; its icon turns into "×".
 *
 * A client component only because the drawer has state. Escape closes it, and so does
 * navigating, so it never stays open over the page it just led to.
 *
 * The label colour on a filled item is the editoria's `textoSobreCor`, not always white as
 * the prototype has it: white on Games, Animes, Vídeos, Séries and Quadrinhos is under
 * 4.5:1 (docs/migration/DECISIONS.md §7).
 */
export function SiteHeader({ nav, ativo, tema = 'light', inicioHref, buscaHref, logo }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const pathname = usePathname();
  const overImage = tema === 'over-image';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onColor = (item: NavItem) =>
    item.neutro || item.textoSobreCor === 'dark' ? 'var(--color-ink)' : 'var(--color-white)';

  return (
    <>
      <header
        className={cx(
          overImage ? 'relative z-2 border-b border-white/18 text-white' : 'border-b border-line-2 bg-bg text-ink',
        )}
      >
        <div className="wrap grid h-56 grid-cols-[44px_1fr_44px] items-center tab:flex tab:h-64 tab:items-stretch tab:gap-24">
          <Link
            href={inicioHref}
            className="col-start-2 row-start-1 flex items-center justify-center tab:mr-12 tab:flex-none tab:justify-start nav:mr-40"
          >
            <Image
              src={overImage ? logo.dark : logo.light}
              alt="Máquina Nerd"
              width={logo.width}
              height={logo.height}
              priority
              className="block h-28 w-auto tab:h-34"
            />
          </Link>

          <nav
            aria-label="Editorias"
            className="no-scrollbar hidden min-w-0 flex-1 justify-start overflow-x-auto tab:flex nav:justify-center"
          >
            {/*
              From 901px the nine items fill a box of the width the article column is built
              on (--mn-nav-w-sm, then --mn-nav-w; app/globals.css), each growing a little.
              Left to size themselves they follow the platform's glyph widths, and the
              column edge — fixed, so nothing reflows — would no longer meet the menu's.
            */}
            <div className="flex shrink-0 desk:w-(--mn-nav-w-sm) nav:w-(--mn-nav-w)">
              {nav.map((item) => {
                const active = item.rotulo === ativo;
                const current = pathname === item.href;
                if (overImage) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className="flex flex-auto items-center justify-center px-12 text-12 font-semibold whitespace-nowrap text-white opacity-90 hover:text-white hover:opacity-100 nav:px-17 nav:text-13"
                    >
                      {item.rotulo}
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className="mn-nav-item relative flex flex-auto items-center justify-center overflow-hidden px-12 text-12 font-semibold whitespace-nowrap nav:px-17 nav:text-13"
                    style={
                      {
                        '--nav-on': onColor(item),
                        '--nav-fill': item.corFundoTexto,
                        background: active ? item.corFundoTexto : undefined,
                        color: active ? onColor(item) : 'var(--color-ink)',
                      } as React.CSSProperties
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="mn-nav-fill absolute inset-x-0 top-0 z-0 h-4 transition-[height,background-color] duration-320 ease-nav"
                      style={{ background: active ? item.corFundoTexto : item.cor }}
                    />
                    <span className="mn-nav-label relative z-1 transition-colors delay-80 duration-200">
                      {item.rotulo}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <Link
            href={buscaHref}
            aria-label="Buscar"
            className={cx(
              'col-start-3 row-start-1 flex h-44 w-44 items-center justify-end tab:ml-10 tab:-mr-14 tab:h-auto tab:w-auto tab:flex-none tab:px-14',
              overImage ? 'text-white hover:text-white' : 'text-ink',
            )}
          >
            <SearchIcon />
          </Link>

          <div className="col-start-1 row-start-1 flex items-center tab:ml-18 tab:flex-none">
            <button
              type="button"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open}
              aria-controls={drawerId}
              onClick={() => setOpen((v) => !v)}
              className="-ml-6 flex size-44 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit tab:-my-8 tab:ml-0 tab:size-32 tab:-mr-8"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>

      <div
        id={drawerId}
        hidden={!open}
        className={cx('border-b border-line-2 bg-bg text-ink', overImage && 'relative z-2')}
      >
        <nav aria-label="Menu de editorias" className="flex flex-col px-16 pt-4 pb-12">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className="flex h-48 items-center border-b border-line-soft text-15 font-semibold"
              style={{ color: item.rotulo === ativo ? 'var(--color-mn-red-text)' : 'var(--color-ink)' }}
            >
              <span aria-hidden="true" className="mr-12 h-18 w-3" style={{ background: item.cor }} />
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
