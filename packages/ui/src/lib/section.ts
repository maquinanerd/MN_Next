/**
 * The site section a path belongs to: `/` for the home and its "mais notícias" pages,
 * otherwise `/{first segment}` — so an editoria, its pages and its articles are one section.
 */
export function currentSection(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '';
  const first = path.split('/').filter(Boolean)[0];
  return !first || first === 'page' ? '/' : `/${first}`;
}
