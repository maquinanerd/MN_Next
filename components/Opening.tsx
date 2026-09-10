import { HeroCard, OverlayCard, SideList, type Chamada } from '@mn/ui';

import { rotulo, tempo } from './meta';

/**
 * The opening shared by the home and every editoria (kit docs/03): the lead across three
 * of the four columns with three overlay cards under it, and the side column with four
 * text items and the 300×250.
 */
export function Opening({
  manchete,
  destaques,
  lateral,
  now,
  modo,
  ordemAnuncio,
  headingLevel = 'h2',
}: {
  manchete: Chamada | null;
  destaques: Chamada[];
  lateral: Chamada[];
  now: Date;
  /** `home`: labels are editorias, times carry the editoria; `editoria`: labels are subjects. */
  modo: 'home' | 'editoria';
  ordemAnuncio?: number;
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
      <SideList
        itens={lateral}
        kicker={label}
        meta={(c) => tempo(c, now, modo === 'home')}
        {...(ordemAnuncio !== undefined ? { ordemAnuncio } : {})}
      />
    </section>
  );
}
