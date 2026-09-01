'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Editorial tabs.
 *
 * Real links, never buttons with local state: the prototype's tab click did not change
 * the URL, which meant no shareable address and no back button. Active state comes from
 * `usePathname()` and is expressed by `aria-current="page"` plus a 3px underline, so it
 * is never carried by colour alone (docs/09).
 */
export interface CategoryTabsProps {
  items: { slug: string; name: string }[];
  /** Overrides pathname detection - used by the "Todas" pseudo-tab. */
  activeSlug?: string;
  basePath?: string;
}

export function CategoryTabs({ items, activeSlug, basePath = '' }: CategoryTabsProps) {
  const pathname = usePathname();

  return (
    <div className="mn-tabs">
      <div className="mn-shell">
        {/* The header nav is already "Editorias"; two landmarks may not share a name. */}
        <nav aria-label="Abas de editoria">
          <ul className="mn-tabs__list">
            {items.map((item) => {
              const href = `${basePath}/${item.slug}`;
              const isActive = activeSlug
                ? activeSlug === item.slug
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={item.slug}>
                  <Link className="mn-tabs__link" href={href} aria-current={isActive ? 'page' : undefined}>
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
