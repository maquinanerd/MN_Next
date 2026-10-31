import Link from "next/link";
import type { CSSProperties } from "react";
import { SITE } from "@/lib/site";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  highlight?: boolean;
}

// Mesma ordem do protótipo (a grade de 6 colunas preenche linha a linha).
// Avaliado ao carregar o módulo (fora da renderização), como pede o Cache Components.
const YEAR = new Date().getFullYear();

const EXPLORE: FooterLink[] = [
  { label: "Games", href: "/games" },
  { label: "Animes", href: "/animes" },
  { label: "Especiais", href: "/especiais" },
  { label: "Vídeos", href: "/videos" },
  { label: "Cinerie", href: SITE.cinerie, external: true },
  { label: "Notícias", href: "/", highlight: true },
  { label: "Cinema", href: "/cinema" },
  { label: "Séries e TV", href: "/series-e-tv" },
  { label: "Quadrinhos", href: "/quadrinhos" },
  { label: "Reviews", href: "/especiais/assunto/critica" },
  { label: "Newsletter", href: "/newsletter" },
];

const LEGAL: FooterLink[][] = [
  [
    { label: "Termos de uso", href: "/termos-de-uso" },
    { label: "Sobre o Máquina Nerd", href: "/sobre" },
    { label: "Política de privacidade", href: "/politica-de-privacidade" },
  ],
  [
    { label: "Cookies", href: "/cookies" },
    { label: "Acessibilidade", href: "/acessibilidade" },
    { label: "Política de afiliados", href: "/politica-de-afiliados" },
  ],
  [
    { label: "Fale com a redação", href: `mailto:${SITE.contactEmail}`, external: true },
    { label: "Newsletter", href: "/newsletter" },
    { label: "Anuncie", href: "/anuncie" },
  ],
];

function FooterAnchor({
  link,
  className,
  style,
}: {
  link: FooterLink;
  className?: string;
  style?: CSSProperties;
}) {
  if (link.external) {
    return (
      <a
        href={link.href}
        className={className}
        style={style}
        rel={link.href.startsWith("http") ? "noopener" : undefined}
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} style={style}>
      {link.label}
    </Link>
  );
}

/**
 * Bloco 1: "Explore o Máquina Nerd" + editorias em 6 colunas.
 * Bloco 2: redes + 4 colunas de institucional/legal.
 * Abaixo de 900px: uma coluna, links em duas.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-mn-line">
      <div className="mn-wrap pt-10 pb-12">
        <div className="grid grid-cols-4 gap-10 le900:grid-cols-1 le900:items-start le900:gap-5">
          <h2 className="m-0 text-base font-extrabold tracking-[-.02em]">Explore o Máquina Nerd</h2>
          <div className="col-span-3 grid grid-cols-6 gap-x-5 gap-y-4 text-xs le900:col-auto le900:grid-cols-2 le900:gap-x-5 le900:gap-y-3.5 le900:[&_a]:leading-[1.4]">
            {EXPLORE.map((link) => (
              <FooterAnchor
                key={link.label}
                link={link}
                style={link.highlight ? { color: "#B00710" } : undefined}
              />
            ))}
          </div>
        </div>
        <div className="mt-14 grid grid-cols-4 items-end gap-10 le900:mt-8 le900:grid-cols-1 le900:items-start le900:gap-5">
          <div className="flex gap-3.5 text-[#555]">
            <a
              href={SITE.social.facebook}
              aria-label="Máquina Nerd no Facebook"
              rel="noopener"
              className="relative before:absolute before:-inset-[15px] before:content-['']"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3-.04-1.3-.13-2.45-.13-2.43 0-4.1 1.48-4.1 4.2v2.34H7.4V13h2.75v8h3.35z" />
              </svg>
            </a>
            <a
              href={SITE.social.x}
              aria-label="Máquina Nerd no X"
              rel="noopener"
              className="relative before:absolute before:-inset-[15px] before:content-['']"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.2L4.7 21H1.5l7.5-8.6L1.2 3h6.6l4.5 5.9L17.5 3zm-1.1 16.1h1.8L7.7 4.8H5.8l10.6 14.3z" />
              </svg>
            </a>
            <a
              href={SITE.social.instagram}
              aria-label="Máquina Nerd no Instagram"
              rel="noopener"
              className="relative before:absolute before:-inset-[15px] before:content-['']"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.1" cy="6.9" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </a>
          </div>
          <div className="col-span-3 grid grid-cols-4 gap-x-5 gap-y-3 text-[11px] text-mn-summary le900:col-auto le900:grid-cols-2 le900:gap-x-5 le900:gap-y-3.5 le900:[&_a]:leading-[1.4]">
            {LEGAL.map((col, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                {col.map((link) => (
                  <FooterAnchor key={link.label} link={link} />
                ))}
              </div>
            ))}
            <p className="m-0 text-[9px] leading-[1.6] text-mn-muted le900:col-span-full">
              © {YEAR} Máquina Nerd. O Máquina Nerd não se responsabiliza pelo conteúdo de sites externos.
              Parte da mesma rede do Cinerie.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
