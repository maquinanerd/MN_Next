import Link from 'next/link';

import { FacebookIcon, InstagramIcon, XIcon } from '../primitives/icons';
import { FooterExplore } from './FooterExplore';

export interface FooterLink {
  rotulo: string;
  href: string;
  /** Text colour when this is the reader's section (an editoria's `corTexto`). */
  cor?: string;
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

function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.externo || link.href.startsWith('mailto:')) {
    return (
      <a href={link.href} {...(link.externo ? { rel: 'noopener' } : {})}>
        {link.rotulo}
      </a>
    );
  }
  return <Link href={link.href}>{link.rotulo}</Link>;
}

/**
 * SiteFooter (kit docs/02).
 *
 * Block 1: "Explore o Máquina Nerd" and the editoria links, six columns (two on a phone),
 * the reader's section in its colour.
 * Block 2: the social links and four columns — three of institutional/legal links, the
 * fourth the closing notice, which names the Cinerie network. At ≤900px each block
 * becomes one column and the link grids two, the notice beside the last column, as the
 * home prototype draws it.
 */
export function SiteFooter({ explorar, colunas, redes, aviso }: SiteFooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="wrap pt-40 pb-48">
        <div className="grid grid-cols-1 items-start gap-20 desk:grid-cols-4 desk:gap-40">
          <h2 className="m-0 text-16 leading-[1.35] font-extrabold tracking-[-0.02em]">Explore o Máquina Nerd</h2>
          <FooterExplore links={explorar} />
        </div>

        <div className="mt-16 grid grid-cols-1 items-start gap-6 desk:mt-56 desk:grid-cols-4 desk:items-end desk:gap-40">
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
            <p className="m-0 text-9 leading-[1.6] text-muted">{aviso}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
