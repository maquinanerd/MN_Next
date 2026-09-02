import Link from 'next/link';
import type { ArticleSummary, HomeBanner, HomeSpecial } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';
import { SectionHeading } from '../primitives/misc';
import { AuthorByline } from '../cards/AuthorByline';
import { articleHref } from '../cards/ArticleCard';

/**
 * The three home modules the approved design has and a grid of cards cannot express.
 *
 * They were missing, and their absence is what made the front page read as a wireframe:
 * an editorial page gets its rhythm from *contrast* — a full-bleed band, then an
 * asymmetric feature, then a dense tail — and replacing all three with the same
 * three-column grid flattens exactly that.
 *
 * Every measurement here is read from the prototype rather than approximated: the banner
 * is 1440/380 with a 90° scrim to the right, the feature splits 700fr against the image,
 * and the tail is a 96px thumbnail beside the headline. Where the design shows data the
 * platform does not have — visit counts under each tail item — the byline is used
 * instead, because inventing a number is worse than showing a different true one.
 */

/**
 * Full-bleed promotional band.
 *
 * The scrim runs left-to-right rather than bottom-up: the art sits on the left of the
 * frame and the words on the right, so the gradient has to darken the side the text is
 * on. A bottom-up scrim over this composition puts white type on a bright sky.
 */
export function HomeBannerBand({ banner, priority = false }: { banner: HomeBanner; priority?: boolean }) {
  const lockup = banner.lockup;

  return (
    <Link className="mn-banner" href={banner.href}>
      {banner.image ? (
        <MnImage image={banner.image} alt="" sizes={SIZES.hero} priority={priority} className="mn-banner__art" />
      ) : null}
      <span className="mn-banner__scrim" aria-hidden="true" />

      <span className="mn-banner__stamp">
        {/*
         * The mark next to the badge, as in the prototype. Plain <img> rather than
         * next/image: it is a fixed 15px-tall PNG from this origin, so the optimiser
         * would add a request and a layout pass to save nothing.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mn-logo-on-dark.png" alt="" width={78} height={15} className="mn-banner__logo" />
        <span className="mn-banner__badge">{banner.label}</span>
      </span>

      <span className="mn-banner__lockup">
        {lockup ? (
          <>
            <span className="mn-banner__over">{lockup.over}</span>
            <span className="mn-banner__main">{lockup.main}</span>
            <span className="mn-banner__under">{lockup.under}</span>
          </>
        ) : (
          // No designed lockup for this item: one line, same weight as the main word.
          <span className="mn-banner__main">{banner.title}</span>
        )}
      </span>

      {banner.tags.length > 0 ? (
        <span className="mn-banner__tags">
          {banner.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * A franchise feature: headline, byline and standfirst on the left, the art on the right.
 *
 * The split is 700 against 520 in the prototype — not halves. That asymmetry is the
 * whole point of the module: it reads as an essay with a picture, where an even split
 * reads as another card.
 */
export function HomeSpecialFeature({ special }: { special: HomeSpecial }) {
  const href = articleHref(special.lead) ?? `/especiais/${special.slug}`;

  return (
    <section className="mn-section" aria-label={`Especial · ${special.name}`}>
      <SectionHeading
        label={special.name}
        accent="Especial"
        href={`/especiais/${special.slug}`}
        linkLabel="Ver o especial"
      />
      <div className="mn-feature">
        <div className="mn-feature__text">
          <h3 className="mn-feature__title">
            <Link href={href}>{special.lead.title}</Link>
          </h3>
          <AuthorByline
            authors={special.lead.authors}
            date={special.lead.publishedAt ?? special.lead.updatedAt}
            suffix={`${special.lead.readingMinutes} min`}
          />
          <p className="mn-card__excerpt">
            {special.lead.excerpt} <Link href={href}>Ler mais</Link>
          </p>
        </div>
        {special.lead.cover ? (
          <Link className="mn-feature__media" href={href} tabIndex={-1} aria-hidden="true">
            <MnImage image={special.lead.cover} alt="" sizes={SIZES.card} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The dense tail of the front page.
 *
 * A 96px thumbnail beside the headline, two per row on a wide screen. The design puts
 * visit and comment counts under each one; neither exists in this platform, so the
 * byline takes that line — the same shape, carrying something true.
 */
export function HomeMoreGrid({ label, articles }: { label: string; articles: ArticleSummary[] }) {
  if (articles.length === 0) return null;

  return (
    <section className="mn-section" aria-label={label}>
      <SectionHeading label={label} />
      <div className="mn-more">
        {articles.map((article) => {
          const href = articleHref(article);
          return (
            <article className="mn-more__item" key={article.id}>
              {article.cover && href ? (
                <Link className="mn-more__media" href={href} tabIndex={-1} aria-hidden="true">
                  <MnImage image={article.cover} alt="" sizes="96px" />
                </Link>
              ) : null}
              <div className="mn-more__body">
                <h4 className="mn-more__title">{href ? <Link href={href}>{article.title}</Link> : article.title}</h4>
                <AuthorByline
                  authors={article.authors}
                  date={article.publishedAt ?? article.updatedAt}
                  size="sm"
                  withAvatar={false}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
