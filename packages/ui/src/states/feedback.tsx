import Link from 'next/link';

/**
 * Neutral states (CLAUDE.md: "estados neutros e acessíveis coerentes com os tokens").
 * No illustration, no icon: a sentence that says what happened and what to do next.
 */
export function EmptyState({
  titulo,
  descricao,
  acao,
  as: H = 'h2',
}: {
  titulo: string;
  descricao?: string;
  acao?: { rotulo: string; href: string };
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="py-48">
      <H className="m-0 text-17 leading-[1.3] font-bold tracking-[-0.015em] tab:text-22">{titulo}</H>
      {descricao ? <p className="mt-8 mb-0 max-w-[60ch] text-13 leading-[1.5] text-excerpt">{descricao}</p> : null}
      {acao ? (
        <Link
          href={acao.href}
          className="mt-20 inline-flex h-40 items-center border border-control px-20 text-12 text-ink"
        >
          {acao.rotulo}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * "Demonstração": the presentation marker for fixture mode (docs/04 — mark the *page*,
 * never the content). It cannot reach a reader: the fixture provider refuses to start in
 * staging or production.
 */
export function DemoBanner() {
  return (
    <div role="note" className="bg-ink text-white">
      <div className="wrap flex min-h-28 items-center py-6 text-11">
        Demonstração — conteúdo de exemplo, sem o CMS conectado. Nenhuma notícia desta página é real.
      </div>
    </div>
  );
}
