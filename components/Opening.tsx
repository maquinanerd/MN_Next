import { HeroCard, OpaPrecoAd, OverlayCard, SideList, type Chamada, type ContextoDoAnuncio } from '@mn/ui';

import { rotulo, tempo } from './meta';

/** An OpaPreço slot under a side list, and what it tells OpaPreço about the page. */
export interface AnuncioLateral {
  slot: 'home-01' | 'home-02' | 'listing-01';
  contexto?: ContextoDoAnuncio;
}

/**
 * The OpaPreço ad under a side list (the opening's, "Últimas de Quadrinhos"), where the
 * 300×250 was: the side list is shorter than the lead and its cards, and the column under
 * it would otherwise stay empty. From 1024px only, OpaPreço's desktop, like the `sidebar`
 * card: on a phone the side list sits under the lead, and between 761 and 1023px the
 * column is too narrow for the card. A slot with no offer collapses and gives the margin
 * back (`.mn-op`).
 */
export function AnuncioDaLateral({ slot, contexto }: AnuncioLateral) {
  return <OpaPrecoAd slot={slot} {...(contexto ? { contexto } : {})} className="mt-24 hidden min-[1024px]:block" />;
}

/**
 * The opening shared by the home and every editoria (kit docs/03): the lead across three
 * of the four columns with three overlay cards under it, and the side column with four
 * text items and, under them, an OpaPreço card.
 */
export function Opening({
  manchete,
  destaques,
  lateral,
  now,
  modo,
  anuncio,
  headingLevel = 'h2',
}: {
  manchete: Chamada | null;
  destaques: Chamada[];
  lateral: Chamada[];
  now: Date;
  /** `home`: labels are editorias, times carry the editoria; `editoria`: labels are subjects. */
  modo: 'home' | 'editoria';
  anuncio?: AnuncioLateral;
  headingLevel?: 'h2' | 'h3';
}) {
  if (!manchete) return null;
  const label = (c: Chamada) => (modo === 'home' ? c.editoria.nome : rotulo(c));
  return (
    <section aria-label="Destaques" className="grid grid-cols-1 items-start gap-14 tab:grid-cols-4 tab:gap-40">
      <div className="flex flex-col gap-14 tab:col-span-3 tab:gap-24">
        <HeroCard chamada={manchete} kicker={label(manchete)} meta={tempo(manchete, now)} as={headingLevel} priority />
        {destaques.length > 0 ? (
          <div className="grid grid-cols-1 gap-14 tab:grid-cols-3 tab:gap-24">
            {destaques.map((c) => (
              <OverlayCard key={c.id} chamada={c} kicker={label(c)} meta={tempo(c, now, modo === 'home')} />
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <SideList itens={lateral} kicker={label} meta={(c) => tempo(c, now, modo === 'home')} />
        {anuncio ? <AnuncioDaLateral {...anuncio} /> : null}
      </div>
    </section>
  );
}
