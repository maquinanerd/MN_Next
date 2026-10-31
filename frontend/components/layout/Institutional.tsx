import type { ReactNode } from "react";
import type { NavKey } from "@/lib/content/editorias";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Páginas institucionais não têm protótipo (docs/03). São compostas com o que o sistema já
 * tem: o cabeçalho da editoria (título de 34px/800 sobre filete) e a coluna de leitura da
 * matéria (17px/1.6, subtítulos de 22px/800).
 */
export function InstitutionalPage({
  titulo,
  intro,
  active,
  children,
}: {
  active?: NavKey;
  titulo: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader active={active} />
      <main id="conteudo" className="mn-wrap pt-8 pb-16 mob:pt-5">
        <div className="mb-7 border-b border-mn-line pb-5">
          <h1 className="m-0 text-[34px] leading-none font-extrabold tracking-[-.03em] mob:text-[28px]">{titulo}</h1>
          {intro && <p className="mt-4 mb-0 max-w-[68ch] text-[15px] leading-normal text-mn-ink-3">{intro}</p>}
        </div>
        <div className="mn-prose">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
