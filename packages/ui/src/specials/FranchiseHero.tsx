import Link from 'next/link';
import type { Franchise } from '@mn/content';

/**
 * The franchise hub's opening band.
 *
 * Full-bleed and dark, with the art behind a vertical scrim, the sibling franchises as
 * pills, and a panel of figures beside the title. It replaced a contained cover with a
 * heading on it, which is a different page: the design opens the hub as a *place* — a
 * destination with its own identity and its own numbers — and a card-sized cover opens it
 * as another article.
 *
 * The figures are the honest part. The prototype shows "9,3 mi na estreia" and "612
 * matérias", neither of which this platform records, and filling those cells with
 * invented numbers would put fiction on a page that otherwise reports. So the panel
 * carries what is actually known and countable: how much has been published, how many
 * dossiers exist, how long the arc runs, when it was last touched.
 */

export interface FranchiseStat {
  value: string;
  label: string;
}

export function FranchiseHero({
  franchise,
  stats,
  siblings,
  eyebrow = 'Especial',
}: {
  franchise: Franchise;
  stats: FranchiseStat[];
  /** The other franchises, rendered as the tab row. */
  siblings: { slug: string; name: string }[];
  eyebrow?: string;
}) {
  return (
    <section className="mn-hub" aria-label={franchise.name}>
      {franchise.cover ? (
        <span
          className="mn-hub__art"
          aria-hidden="true"
          style={{ backgroundImage: `url(${JSON.stringify(franchise.cover.url)})` }}
        />
      ) : null}
      <span className="mn-hub__veil" aria-hidden="true" />

      <div className="mn-hub__inner">
        {siblings.length > 1 ? (
          <nav className="mn-hub__tabs" aria-label="Franquias">
            {siblings.map((sibling) => (
              <Link
                key={sibling.slug}
                href={`/especiais/${sibling.slug}`}
                className={sibling.slug === franchise.slug ? 'mn-hub__tab mn-hub__tab--on' : 'mn-hub__tab'}
                {...(sibling.slug === franchise.slug ? { 'aria-current': 'page' as const } : {})}
              >
                {sibling.name}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="mn-hub__row">
          <div className="mn-hub__lede">
            <p className="mn-hub__eyebrow">
              <span className="mn-hub__eyebrowrule" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 className="mn-hub__title">{franchise.name}</h1>
            <p className="mn-hub__desc">{franchise.description}</p>
          </div>

          {stats.length > 0 ? (
            <dl className="mn-hub__stats">
              {stats.map((stat) => (
                <div className="mn-hub__stat" key={stat.label}>
                  <dt className="mn-hub__statlabel">{stat.label}</dt>
                  <dd className="mn-hub__statvalue">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
