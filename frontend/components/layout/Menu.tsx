"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NavItem, NavKey } from "@/lib/content/editorias";

const DRAWER_ID = "mn-drawer";

interface MenuState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MenuContext = createContext<MenuState | null>(null);

function useMenu(): MenuState {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("MenuButton e MobileDrawer precisam estar dentro de MenuRoot");
  return ctx;
}

/** Guarda o estado da gaveta para o botão (no cabeçalho) e a gaveta (logo abaixo dele). */
export function MenuRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  // Fecha ao navegar (ajuste de estado durante a renderização, sem efeito).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        document.querySelector<HTMLButtonElement>("[data-mn-menu-button]")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

const ICON_OPEN = "M4 7h16M4 12h16M4 17h16";
const ICON_CLOSE = "M6 6l12 12M18 6L6 18";

export function MenuButton() {
  const { open, toggle } = useMenu();
  return (
    <button
      type="button"
      data-mn-menu-button=""
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onClick={toggle}
      className="relative -my-2 -mr-2 flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-inherit before:absolute before:-inset-1.5 before:content-['']"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d={open ? ICON_CLOSE : ICON_OPEN} />
      </svg>
    </button>
  );
}

/** Gaveta vertical: 48px por item, filete de 3px na cor da editoria, item atual em vermelho-texto. */
export function MobileDrawer({ items, active }: { items: NavItem[]; active?: NavKey }) {
  const { open, close } = useMenu();
  return (
    <div id={DRAWER_ID} hidden={!open} className="relative z-[3] border-b border-mn-line-2 bg-white text-mn-ink">
      <nav aria-label="Menu" className="flex flex-col px-4 pt-1 pb-3">
        {items.map((item) => {
          const current = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={close}
              aria-current={current ? "page" : undefined}
              className="flex h-12 items-center border-b border-[#F0F0F0] text-[15px] font-semibold"
              style={{ color: current ? "#B00710" : "#111" }}
            >
              <span aria-hidden="true" className="mr-3 h-[18px] w-[3px]" style={{ background: item.cor }} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
