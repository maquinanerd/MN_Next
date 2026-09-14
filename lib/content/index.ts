/**
 * The content adapter (kit PROMPT-FRONTEND.md, "Dados"): routes and components get the
 * view model from here and never learn where it came from. Swapping the CMS means
 * swapping the repository behind `repo()`; nothing above this module changes.
 */
export * from './repo';
export * from './pages';
export { EDITORIAS, NAV, NOTICIAS, footerProps } from './editorias';
export { toChamada, toChamadas, toMateria, toBlocos, withAds, withRelatedInline, assuntoOf } from './map';
