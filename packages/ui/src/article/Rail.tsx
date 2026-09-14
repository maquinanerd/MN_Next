import Image from 'next/image';
import Link from 'next/link';

import { cx } from '../lib/cx';
import type { Autor, Filtro, Materia } from '../model';
import { FacebookIcon, GlobeIcon, InstagramIcon, XIcon } from '../primitives/icons';
import { Dates } from './Header';

export interface EditoriaLink {
  rotulo: string;
  href: string;
  externo?: boolean;
}

export interface NestaEditoria {
  /** The article's own editoria, then its subjects, then the other editorias. */
  editoria: { nome: string; href: string; corTexto: string };
  assuntos: Filtro[];
  outras: EditoriaLink[];
  todos: { rotulo: string; href: string };
}

const SOCIAL = {
  site: { Icon: GlobeIcon, label: 'Site' },
  facebook: { Icon: FacebookIcon, label: 'Facebook' },
  instagram: { Icon: InstagramIcon, label: 'Instagram' },
  x: { Icon: XIcon, label: 'X' },
} as const;

function AuthorBlock({ autor }: { autor: Autor }) {
  const redes = autor.redes ?? [];
  const nameBlock = (
    <span className="flex flex-col gap-7">
      <Link href={autor.href} className="text-14 font-extrabold tracking-[-0.02em]">
        {autor.nome}
      </Link>
      {redes.length > 0 ? (
        <span className="flex gap-8 text-ink">
          {redes.map((r) => {
            const { Icon, label } = SOCIAL[r.tipo];
            return (
              <a key={r.tipo} href={r.url} aria-label={`${label} de ${autor.nome}`} rel="noopener">
                <Icon size={r.tipo === 'x' ? 11 : 12} />
              </a>
            );
          })}
        </span>
      ) : null}
    </span>
  );
  // Without a real portrait there is no disc at all — only the name (docs/04).
  if (!autor.avatar) return <div className="mb-14">{nameBlock}</div>;
  return (
    <div className="mb-14 grid grid-cols-[52px_1fr] items-center gap-14">
      <span className="relative block size-52 overflow-hidden rounded-full bg-media">
        <Image src={autor.avatar} alt="" fill sizes="52px" className="object-cover" />
      </span>
      {nameBlock}
    </div>
  );
}

/** "NESTA EDITORIA": the editoria, its subjects indented between rules, the others. */
export function EditoriaList({ nav, label = 'Nesta editoria' }: { nav: NestaEditoria; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-col gap-10">
      <Link href={nav.editoria.href} className="font-bold" style={{ color: nav.editoria.corTexto }}>
        {nav.editoria.nome}
      </Link>
      {nav.assuntos.length > 0 ? (
        <div className="ml-16 flex flex-col gap-8 border-y border-line py-10 text-11 text-muted">
          {nav.assuntos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={a.ativo ? 'text-ink' : undefined}
              aria-current={a.ativo ? 'true' : undefined}
            >
              {a.rotulo}
            </Link>
          ))}
        </div>
      ) : null}
      {nav.outras.map((o, i) =>
        o.externo ? (
          <a key={o.href} href={o.href} rel="noopener" className={cx(i === 0 && 'mt-8')}>
            {o.rotulo}
          </a>
        ) : (
          <Link key={o.href} href={o.href} className={cx(i === 0 && 'mt-8')}>
            {o.rotulo}
          </Link>
        ),
      )}
      <Link href={nav.todos.href} className="mt-14 w-max text-muted underline decoration-underline underline-offset-3">
        {nav.todos.rotulo}
      </Link>
    </nav>
  );
}

/**
 * AuthorRail (kit docs/02): the 200px left column of the standard article — author,
 * dates, and "Nesta editoria". Hidden at ≤900px, where the editoria band takes over.
 */
export function AuthorRail({ materia, nav }: { materia: Materia; nav: NestaEditoria }) {
  return (
    <div className="hidden pb-48 text-12 desk:block">
      {materia.autores.map((a) => (
        <AuthorBlock key={a.slug} autor={a} />
      ))}
      <div className="mb-20 border-b border-line pb-20 text-11 leading-[1.6] text-byline">
        <Dates materia={materia} />
      </div>
      <div className="mb-16 text-16 font-extrabold tracking-[-0.02em] uppercase">
        Nesta<span className="font-light"> editoria</span>
      </div>
      <EditoriaList nav={nav} />
    </div>
  );
}

/**
 * The editoria band that replaces the rail at ≤900px: 40px in the editoria colour with its
 * name and a menu glyph. The prototype draws the glyph and gives it nothing to do; here it
 * opens the same "Nesta editoria" list, as a native disclosure that needs no script.
 */
export function EditoriaBand({ materia, nav }: { materia: Materia; nav: NestaEditoria }) {
  const on = materia.editoria.textoSobreCor === 'light' ? 'var(--color-white)' : 'var(--color-ink)';
  return (
    <details className="group desk:hidden">
      <summary
        className="flex h-40 cursor-pointer list-none items-center justify-between px-16 text-14 [&::-webkit-details-marker]:hidden"
        style={{ background: materia.editoria.corFundoTexto, color: on }}
      >
        <span>{materia.editoria.nome}</span>
        <span className="sr-only">: mostrar a lista de assuntos e editorias</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <div className="border-b border-line px-16 py-16 text-12">
        {/* A distinct name: the rail's copy of this list is in the same document. */}
        <EditoriaList nav={nav} label="Nesta editoria (menu)" />
      </div>
    </details>
  );
}
