import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { NAV, ON_COLOR, type NavKey } from "@/lib/content/editorias";
import { MenuButton, MenuRoot, MobileDrawer } from "./Menu";

type Tema = "light" | "over-image";

/** Nove itens com filete de 4px na cor da editoria; o ativo já vem preenchido. */
export function EditoriaNav({ active, tema = "light" }: { active?: NavKey; tema?: Tema }) {
  return (
    <nav
      aria-label="Editorias"
      className={`mn-nav flex min-w-0 flex-1 justify-center-safe overflow-x-auto le1180:justify-start mob:hidden ${
        tema === "over-image" ? "mn-nav--over" : ""
      }`}
    >
      {NAV.map((item) => {
        const current = item.key === active;
        const style = { "--nav-c": item.cor, "--nav-on": ON_COLOR[item.textoSobreCor] } as CSSProperties;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="mn-nav-item"
            aria-current={current && tema === "light" ? "page" : undefined}
            aria-label={item.key === "mais" ? "Mais seções do Máquina Nerd" : undefined}
            style={style}
          >
            <span className="mn-nav-fill" aria-hidden="true" />
            <span className="mn-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Desktop: logo · nav centralizada · busca e menu; 64px, borda de 1px.
 * Mobile (≤760): grade 44px · 1fr · 44px — menu, logo centralizada, busca; 56px.
 */
export function SiteHeader({ active, tema = "light" }: { active?: NavKey; tema?: Tema }) {
  const over = tema === "over-image";
  return (
    <MenuRoot>
      <header
        className={over ? "relative z-[2] border-b border-white/[.18] text-white" : "border-b border-mn-line-2 text-mn-ink"}
      >
        <div className="mn-wrap flex h-16 items-stretch gap-6 mob:grid mob:h-14 mob:grid-cols-[44px_minmax(0,1fr)_44px] mob:items-center mob:gap-0">
          <Link
            href="/"
            aria-label="Máquina Nerd, página inicial"
            className="mr-10 flex flex-none items-center le1180:mr-3 mob:order-1 mob:col-start-2 mob:row-start-1 mob:m-0 mob:justify-center"
          >
            <Image
              src={over ? "/logo-on-dark.png" : "/logo-on-light.png"}
              alt="Máquina Nerd"
              width={267}
              height={65}
              loading="eager"
              className="block h-[34px] w-auto mob:h-7"
            />
          </Link>
          <EditoriaNav active={active} tema={tema} />
          <Link
            href="/busca"
            aria-label="Buscar"
            className={`relative ml-6 flex flex-none items-center before:absolute before:-inset-[14px] before:content-[''] mob:order-2 mob:col-start-3 mob:row-start-1 mob:m-0 mob:justify-end ${
              over ? "hover:text-white" : "hover:text-mn-ink"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20.5 20.5l-4.7-4.7" />
            </svg>
          </Link>
          <div className="ml-[18px] flex flex-none items-center mob:order-0 mob:col-start-1 mob:row-start-1 mob:m-0 mob:justify-start">
            <MenuButton />
          </div>
        </div>
      </header>
      <MobileDrawer items={NAV} active={active} />
    </MenuRoot>
  );
}
