import Link from 'next/link';

import { FacebookIcon, InstagramIcon, XIcon } from '../primitives/icons';

export interface FooterLink {
  rotulo: string;
  href: string;
  ativo?: boolean;
  externo?: boolean;
}

export interface SiteFooterProps {
  explorar: FooterLink[];
  /** Up to three columns of institutional and legal links. */
  colunas: FooterLink[][];
  redes: { tipo: 'facebook' | 'x' | 'instagram'; href: string; rotulo: string }[];
  /** The closing notice: copyright, external-content disclaimer, the Cinerie network. */
  aviso: string;
}

const ICON = { facebook: FacebookIcon, x: XIcon, instagram: InstagramIcon } as const;

function FooterAnchor({ link, className }: { link: FooterLink; className?: string }) {
  if (link.externo || link.href.startsWith('mailto:')) {
    return (
      <a href={link.href} className={className} {...(link.externo ? { rel: 'noopener' } : {})}>
        {link.rotulo}
      </a>
    );
  }
  return (
    <Link
      href={link.href}
      className={className}
      style={link.ativo ? { color: 'var(--color-mn-red-text)' } : undefined}
      aria-current={link.ativo ? 'page' : undefined}
    >
      {link.rotulo}
    </Link>
  );
}

/**
 * SiteFooter (kit docs/02).
 *
 * Block 1: "Explore o Máquina Nerd" and the editoria links, six columns (two on a phone).
 * Block 2: the social links and four columns — three of institutional/legal links, the
 * fourth the closing notice, which names the Cinerie network. At ≤900px each block
 * becomes one column and the link grids two.
 */
export function SiteFooter({ explorar, colunas, redes, aviso }: SiteFooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="wrap pt-40 pb-48">
        <div className="grid grid-cols-1 items-start gap-20 desk:grid-cols-4 desk:gap-40">
          <h2 className="m-0 text-16 leading-[1.35] font-extrabold tracking-[-0.02em]">Explore o Máquina Nerd</h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-20 gap-y-14 p-0 text-12 desk:col-span-3 desk:grid-cols-6 desk:gap-y-16">
            {explorar.map((link) => (
              <li key={link.href} className="leading-[1.4] desk:leading-[1.35]">
                <FooterAnchor link={link} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-32 grid grid-cols-1 items-start gap-20 desk:mt-56 desk:grid-cols-4 desk:items-end desk:gap-40">
          <ul aria-label="Redes sociais" className="m-0 flex list-none p-0 text-byline desk:gap-14">
            {redes.map((rede) => {
              const Icon = ICON[rede.tipo];
              return (
                <li key={rede.tipo}>
                  <a
                    href={rede.href}
                    aria-label={rede.rotulo}
                    rel="noopener"
                    className="flex size-44 items-center justify-center first:-ml-15 desk:-m-7 desk:size-28"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-x-20 gap-y-14 text-11 text-excerpt desk:col-span-3 desk:grid-cols-4 desk:gap-y-12">
            {colunas.map((coluna, i) => (
              <ul key={i} className="m-0 flex list-none flex-col gap-10 p-0">
                {coluna.map((link) => (
                  <li key={link.href} className="leading-[1.4] desk:leading-[1.35]">
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            ))}
            <p className="col-span-2 m-0 text-9 leading-[1.6] text-muted desk:col-span-1">{aviso}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
