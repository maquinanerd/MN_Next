import Link from 'next/link';

/**
 * Visible breadcrumbs. The same array feeds the `BreadcrumbList` in the page's JSON-LD,
 * so the structured data can never disagree with what a reader sees.
 */
export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="mn-breadcrumbs" aria-label="Trilha de navegação">
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.href && !last ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
              {last ? null : (
                <span className="mn-breadcrumbs__sep" aria-hidden="true">
                  {' '}
                  ›{' '}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
