import type { WatchTitle } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { SectionHeading } from '../primitives/misc';

/**
 * "Onde assistir" - the Cinerie surface hosted by Máquina Nerd.
 *
 * Two rules from docs/10 are structural here:
 *  - the block keeps the Cinerie accent and an explicit credit to the sibling desk; it
 *    never passes as Máquina Nerd reporting;
 *  - passing `null`/`[]` renders nothing at all. A Cinerie outage must degrade this
 *    module to absence, never to an error box on the Máquina Nerd home.
 */
export function WhereToWatch({
  titles,
  attribution = true,
  heading = 'Onde assistir',
}: {
  titles: WatchTitle[] | null;
  attribution?: boolean;
  heading?: string;
}) {
  if (!titles || titles.length === 0) return null;

  return (
    <section className="mn-wheretowatch" aria-label={heading}>
      <SectionHeading label={heading} href="https://cinerie.com/" linkLabel="Ver no Cinerie" tone="dark" />
      <p className="mn-wheretowatch__intro">
        Disponibilidade de streaming apurada pela redação do <strong>Cinerie</strong>, nosso site irmão de cinema e
        séries. Atualizada diariamente.
      </p>

      <div className="mn-wheretowatch__grid">
        {titles.map((title) => {
          const art = title.still ?? title.poster;
          const primary = title.availability[0];
          return (
            <a className="mn-wheretowatch__card" key={title.id} href={title.url} rel="noopener">
              <span className="mn-wheretowatch__media" style={{ position: 'relative', display: 'block' }}>
                <MnImage image={art} alt="" sizes={SIZES.card} />
              </span>
              <span className="mn-wheretowatch__title">{title.title}</span>
              {primary ? (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="mn-platform">{primary.platform}</span>
                  {primary.note ? <span className="mn-wheretowatch__note">{primary.note}</span> : null}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>

      {attribution ? (
        <p className="mn-wheretowatch__credit">
          Dados de disponibilidade por{' '}
          <a href="https://cinerie.com/" rel="noopener">
            Cinerie
          </a>
          , site irmão do Máquina Nerd.
        </p>
      ) : null}
    </section>
  );
}
