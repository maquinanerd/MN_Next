import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Autor, Materia, RedeTipo } from "@/lib/content/types";
import { EDITORIA_SLUGS, EDITORIAS, slugify } from "@/lib/content/editorias";
import { dataLonga, dataLongaHora } from "@/lib/format/date";
import { SITE } from "@/lib/site";

const ICONES: Record<RedeTipo, ReactNode> = {
  site: (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  facebook: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3-.04-1.3-.13-2.45-.13-2.43 0-4.1 1.48-4.1 4.2v2.34H7.4V13h2.75v8h3.35z" />
    </svg>
  ),
  instagram: (
    <svg
      width="12"
      height="12"
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
  ),
  x: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.2L4.7 21H1.5l7.5-8.6L1.2 3h6.6l4.5 5.9L17.5 3zm-1.1 16.1h1.8L7.7 4.8H5.8l10.6 14.3z" />
    </svg>
  ),
};

const NOME_REDE: Record<RedeTipo, string> = {
  site: "Site",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
};

/** Avatar circular só com retrato real; sem retrato, só o nome (docs/04). */
export function Avatar({ autor, size }: { autor: Autor; size: 40 | 44 | 52 }) {
  if (!autor.avatar) return null;
  return (
    <span
      className="block flex-none overflow-hidden rounded-full bg-mn-media"
      style={{ width: size, height: size }}
    >
      <Image
        src={autor.avatar}
        alt=""
        width={size}
        height={size}
        className="block h-full w-full object-cover"
      />
    </span>
  );
}

export function Datas({ materia, inline = false }: { materia: Materia; inline?: boolean }) {
  const atualizado =
    materia.atualizadoEm && materia.atualizadoEm !== materia.publicadoEm
      ? dataLongaHora(materia.atualizadoEm)
      : null;
  const publicado = <time dateTime={materia.publicadoEm}>{dataLonga(materia.publicadoEm)}</time>;
  if (inline)
    return (
      <span className="text-[11px] text-[#555]">
        Publicado em {publicado}
        {atualizado && (
          <>
            {" "}
            · atualizado em <time dateTime={materia.atualizadoEm}>{atualizado}</time>
          </>
        )}
      </span>
    );
  return (
    <div className="mb-5 border-b border-mn-line pb-5 text-[11px] leading-[1.6] text-[#555]">
      <div>Publicado em {publicado}</div>
      {atualizado && (
        <div className="text-mn-muted">
          Atualizado em <time dateTime={materia.atualizadoEm}>{atualizado}</time>
        </div>
      )}
    </div>
  );
}

/**
 * Coluna do autor (200px): avatar, nome, redes, datas e "Nesta editoria" com os assuntos
 * da editoria e as demais. Some abaixo de 900px.
 */
export function AuthorRail({ materia }: { materia: Materia }) {
  const autor = materia.autorDetalhe;
  const ed = EDITORIAS[materia.editoria.slug];
  const assuntoAtual = materia.assunto ? slugify(materia.assunto) : undefined;
  return (
    <aside aria-label="Sobre a matéria" className="pb-12 text-xs le900:hidden">
      {autor && (
        <div
          className={`mb-3.5 grid items-center gap-3.5 ${autor.avatar ? "grid-cols-[52px_1fr]" : "grid-cols-1"}`}
        >
          <Avatar autor={autor} size={52} />
          <span className="flex flex-col gap-[7px]">
            <span className="text-sm font-extrabold tracking-[-.02em]">{autor.nome}</span>
            {autor.redes?.length ? (
              <span className="flex gap-2 text-mn-ink">
                {autor.redes.map((r) => (
                  <a
                    key={r.tipo}
                    href={r.url}
                    aria-label={`${autor.nome}: ${NOME_REDE[r.tipo]}`}
                    rel="noopener"
                    target="_blank"
                  >
                    {ICONES[r.tipo]}
                  </a>
                ))}
              </span>
            ) : null}
          </span>
        </div>
      )}
      <Datas materia={materia} />
      <div className="mb-4 text-base font-extrabold tracking-[-.02em] uppercase">
        NESTA<span className="font-light"> EDITORIA</span>
      </div>
      <nav aria-label="Nesta editoria" className="flex flex-col gap-2.5 leading-[1.35]">
        <Link href={`/${ed.slug}`} className="font-bold" style={{ color: ed.corTexto }}>
          {ed.nome}
        </Link>
        {/* 10px entre os assuntos (8px no protótipo): alvos de toque com 24px de passo (WCAG 2.5.8). */}
        <div className="ml-4 flex flex-col gap-2.5 border-y border-mn-line py-2.5 text-[11px] text-mn-muted">
          <Link href={`/${ed.slug}`}>Todos</Link>
          {ed.assuntos.slice(1).map((a) => (
            <Link
              key={a}
              href={`/${ed.slug}/assunto/${slugify(a)}`}
              style={slugify(a) === assuntoAtual ? { color: "#111" } : undefined}
            >
              {a}
            </Link>
          ))}
        </div>
        <span className="mt-2 flex flex-col gap-2.5">
          {EDITORIA_SLUGS.filter((s) => s !== ed.slug).map((s) => (
            <Link key={s} href={`/${s}`}>
              {EDITORIAS[s].nome}
            </Link>
          ))}
          <Link href="/especiais/assunto/critica">Reviews</Link>
          <a href={SITE.cinerie} rel="noopener">
            Cinerie
          </a>
        </span>
        <Link
          href={`/${ed.slug}`}
          className="mt-3.5 w-max text-mn-muted underline decoration-[#DDD] underline-offset-3"
        >
          Todo o {ed.nome}
        </Link>
      </nav>
    </aside>
  );
}

/** Linha de autor horizontal (matéria overlay e de oferta). */
export function AuthorLine({
  materia,
  size,
  prefixo = "",
}: {
  materia: Materia;
  size: 40 | 44;
  prefixo?: string;
}) {
  const autor = materia.autorDetalhe;
  return (
    <div className="flex items-center gap-3.5">
      {autor && <Avatar autor={autor} size={size} />}
      <span className="flex flex-col gap-[3px]">
        {autor && (
          <span className="text-sm font-extrabold tracking-[-.02em]">
            {prefixo}
            {autor.nome}
          </span>
        )}
        <Datas materia={materia} inline />
      </span>
    </div>
  );
}
