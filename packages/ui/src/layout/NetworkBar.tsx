import Link from 'next/link';
import { NETWORK_LINKS } from '@mn/content';

import { Shell } from '../primitives/misc';

/**
 * The network strip that sits above the header on every page of both portals.
 *
 * Fixed height, no JavaScript, no data dependency: it must never move the header down
 * after paint. `aria-label` distinguishes it from the main nav, which the a11y doc
 * requires of every `<nav>` on the page.
 */
export function NetworkBar({ active = 'mn' }: { active?: 'mn' | 'cinerie' }) {
  return (
    <div className="mn-networkbar">
      <Shell>
        <div className="mn-networkbar__inner">
          <span className="mn-networkbar__label">Rede</span>
          <nav aria-label="Portais da rede">
            <ul className="mn-networkbar__links">
              {NETWORK_LINKS.map((link) => {
                const isActive = link.brand === active;
                return (
                  <li key={link.brand}>
                    <a
                      className="mn-networkbar__link"
                      href={link.href}
                      aria-current={isActive ? 'true' : undefined}
                      {...(isActive ? {} : { rel: 'noopener' })}
                    >
                      <span
                        className={
                          link.brand === 'cinerie'
                            ? 'mn-networkbar__dot mn-networkbar__dot--cinerie'
                            : 'mn-networkbar__dot'
                        }
                        aria-hidden="true"
                      />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Link className="mn-networkbar__cta" href="/newsletter">
            Newsletter
          </Link>
        </div>
      </Shell>
    </div>
  );
}
